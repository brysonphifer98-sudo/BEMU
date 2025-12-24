require('dotenv').config()
const express = require('express')
const path = require('path')
const fs = require('fs')
const Stripe = require('stripe')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')
const bodyParser = require('body-parser')
const db = require('./db')

const app = express()
const PORT = process.env.PORT || 3000
const stripeKey = process.env.STRIPE_SECRET_KEY
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme'
if(!stripeKey){
  console.warn('Warning: STRIPE_SECRET_KEY is not set. Checkout will fail until you set it.')
}
const stripe = stripeKey ? Stripe(stripeKey) : null

app.use(cors())
// keep a raw copy of the JSON body for Stripe webhook verification
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf } }))

// Serve frontend static files (assumes server.js lives in BEMU/server/)
app.use(express.static(path.join(__dirname, '..')))

app.get('/api/products', (req, res)=>{
  const file = path.join(__dirname, 'products.json')
  fs.readFile(file, 'utf8', (err, data)=>{
    if(err) return res.status(500).json({error:'failed to load products'})
    res.type('json').send(data)
  })
})

function createJWT(payload){
  const secret = process.env.JWT_SECRET || 'dev-secret'
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

function authMiddleware(req,res,next){
  const auth = req.headers.authorization
  if(!auth) return res.status(401).json({error:'missing auth'})
  const token = auth.split(' ')[1]
  try{
    const secret = process.env.JWT_SECRET || 'dev-secret'
    const decoded = jwt.verify(token, secret)
    req.user = decoded
    next()
  }catch(e){
    res.status(401).json({error:'invalid token'})
  }
}

app.post('/api/register', async (req,res)=>{
  const {email,password} = req.body||{}
  if(!email || !password) return res.status(400).json({error:'email and password required'})
  const hash = await bcrypt.hash(password, 10)
  db.run(`INSERT INTO users (email,password_hash) VALUES (?,?)`, [email,hash], function(err){
    if(err) return res.status(400).json({error:'could not create user'})
    const token = createJWT({id:this.lastID,email})
    res.json({token})
  })
})

app.post('/api/login', (req,res)=>{
  const {email,password} = req.body||{}
  if(!email || !password) return res.status(400).json({error:'email and password required'})
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err,row)=>{
    if(err || !row) return res.status(400).json({error:'invalid credentials'})
    const ok = await bcrypt.compare(password, row.password_hash)
    if(!ok) return res.status(400).json({error:'invalid credentials'})
    const token = createJWT({id:row.id,email:row.email})
    res.json({token})
  })
})

app.get('/api/me', authMiddleware, (req,res)=>{
  res.json({user:req.user})
})

app.post('/api/create-checkout-session', async (req, res)=>{
  if(!stripe) return res.status(500).json({error:'Stripe not configured'})
  const {items, email} = req.body || {}
  if(!items || Object.keys(items).length===0) return res.status(400).json({error:'cart empty'})

  // load products
  const products = JSON.parse(fs.readFileSync(path.join(__dirname,'products.json'),'utf8'))

  const line_items = []
  let total_cents = 0
  for(const [idStr, qty] of Object.entries(items)){
    const p = products.find(x=>x.id===Number(idStr))
    if(!p) continue
    const cents = Math.round(p.price*100)
    total_cents += cents*qty
    line_items.push({
      price_data: {
        currency: 'usd',
        product_data: { name: p.name, images: [p.img] },
        unit_amount: cents
      },
      quantity: qty
    })
  }

  // persist order (status pending)
  db.run(`INSERT INTO orders (email,stripe_session_id,status,total_cents) VALUES (?,?,?,?)`, [email||null,null,'pending',total_cents], function(err){
    if(err){ console.error(err); }
    const orderId = this.lastID
    // insert items
    const stmt = db.prepare(`INSERT INTO order_items (order_id,product_id,name,unit_price_cents,quantity) VALUES (?,?,?,?,?)`)
    for(const [idStr, qty] of Object.entries(items)){
      const p = products.find(x=>x.id===Number(idStr))
      if(!p) continue
      stmt.run(orderId, p.id, p.name, Math.round(p.price*100), qty)
    }
    stmt.finalize()

    // create stripe session
    (async ()=>{
      try{
        const origin = req.headers.origin || `http://localhost:${PORT}`
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items,
          mode: 'payment',
          success_url: `${origin}/?success=1&order=${orderId}`,
          cancel_url: `${origin}/?canceled=1&order=${orderId}`,
          customer_email: email
        })
        // update order with stripe session id
        db.run(`UPDATE orders SET stripe_session_id = ? WHERE id = ?`, [session.id, orderId])
        res.json({url: session.url})
      }catch(err){
        console.error(err)
        res.status(500).json({error:'failed creating session'})
      }
    })()
  })
})

// Admin endpoints
app.get('/api/admin/orders', (req,res)=>{
  const auth = req.headers.authorization || ''
  const token = auth.split(' ')[1]
  if(token !== ADMIN_TOKEN) return res.status(401).json({error:'unauthorized'})
  db.all(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`, [], (err,rows)=>{
    if(err) return res.status(500).json({error:'db error'})
    res.json(rows)
  })
})

app.get('/api/admin/orders/:id', (req,res)=>{
  const auth = req.headers.authorization || ''
  const token = auth.split(' ')[1]
  if(token !== ADMIN_TOKEN) return res.status(401).json({error:'unauthorized'})
  const id = Number(req.params.id)
  db.get(`SELECT * FROM orders WHERE id = ?`, [id], (err,order)=>{
    if(err || !order) return res.status(404).json({error:'not found'})
    db.all(`SELECT * FROM order_items WHERE order_id = ?`, [id], (err2,items)=>{
      res.json({order,items})
    })
  })
})

// Stripe webhook handler to update order status after payment
app.post('/webhook', (req, res) => {
  if(!stripe) return res.status(500).send('Stripe not configured')
  const sig = req.headers['stripe-signature']
  let event
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    // Dev mode: no webhook secret set — accept the event payload without signature verification.
    // WARNING: this is insecure and should only be used for local testing.
    try {
      event = req.body
      console.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev only)')
    } catch (err) {
      console.error('Failed to parse webhook payload', err.message)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }
  } else {
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed.', err.message)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const sessionId = session.id
    // mark order as paid in DB where stripe_session_id matches
    db.run(`UPDATE orders SET status = 'paid' WHERE stripe_session_id = ?`, [sessionId], function(err){
      if(err) console.error('Failed updating order status', err)
      else console.log('Order marked paid for session', sessionId)
    })
  }

  res.json({received: true})
})

app.listen(PORT, ()=>{
  console.log(`BEMU server running on http://localhost:${PORT}`)
  console.log('process.env.PORT=', process.env.PORT)
})
