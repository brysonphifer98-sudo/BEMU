const PRODUCTS_URL = '/api/products'
const qs = s=>document.querySelector(s)
let products = []
let cart = JSON.parse(localStorage.getItem('bemu_cart')||'{}')
let token = localStorage.getItem('bemu_token') || null

function saveCart(){ localStorage.setItem('bemu_cart', JSON.stringify(cart)); renderCartCount(); renderCartItems(); }

function renderProducts(){
  const container = qs('#products')
  container.innerHTML = ''
  products.forEach(p=>{
    const el = document.createElement('article')
    el.className = 'product'
    el.innerHTML = `
      <img src="${p.img}" alt="${p.name}" data-id="${p.id}" class="product-img" />
      <h4>${p.name}</h4>
      <p>${p.desc}</p>
      <div class="meta"><strong>$${p.price.toFixed(2)}</strong><button class="btn add" data-id="${p.id}">Add</button></div>
    `
    container.appendChild(el)
  })
  container.addEventListener('click', e=>{
    const img = e.target.closest('.product-img')
    if(img){ const id = Number(img.dataset.id); openProductModal(id); return }
    const btn = e.target.closest('.add'); if(!btn) return
    const id = btn.dataset.id
    addToCart(Number(id))
  })
}

function addToCart(id){ cart[id] = (cart[id]||0)+1; saveCart() }

function removeFromCart(id){ delete cart[id]; saveCart() }

function changeQty(id, delta){ cart[id] = Math.max(0,(cart[id]||0)+delta); if(cart[id]===0) delete cart[id]; saveCart() }

function renderCartCount(){
  const count = Object.values(cart).reduce((s,n)=>s+n,0)
  qs('#cart-count').textContent = count
}

function renderCartItems(){
  const list = qs('#cart-items'); list.innerHTML = ''
  let total = 0
  for(const [idStr, qty] of Object.entries(cart)){
    const p = products.find(x=>x.id===Number(idStr))
    if(!p) continue
    total += p.price*qty
    const li = document.createElement('li')
    li.innerHTML = `
      <div>${p.name} × ${qty}</div>
      <div>
        <button data-id="${p.id}" class="small sub">-</button>
        <button data-id="${p.id}" class="small add">+</button>
        <button data-id="${p.id}" class="small rem">✕</button>
      </div>
    `
    list.appendChild(li)
  }
  qs('#cart-total').textContent = total.toFixed(2)
}

async function init(){
  try{
    products = await (await fetch(PRODUCTS_URL)).json()
  }catch(e){ products = [] }
  renderProducts(); renderCartCount(); renderCartItems();
  handleUrlSuccess()
}

// UI controls
qs('#cart-btn').addEventListener('click', ()=> qs('#cart-panel').hidden = !qs('#cart-panel').hidden)
qs('#close-cart').addEventListener('click', ()=> qs('#cart-panel').hidden = true)
qs('#cart-items').addEventListener('click', e=>{
  const id = e.target.dataset.id; if(!id) return
  if(e.target.classList.contains('add')) changeQty(Number(id),1)
  if(e.target.classList.contains('sub')) changeQty(Number(id),-1)
  if(e.target.classList.contains('rem')) removeFromCart(Number(id))
})

qs('#checkout-btn').addEventListener('click', ()=>{
  qs('#checkout-modal').hidden = false
  const summary = qs('.order-summary');
  summary.innerHTML = ''
  for(const [id,qty] of Object.entries(cart)){
    const p = products.find(x=>x.id===Number(id))
    if(!p) continue
    const div = document.createElement('div'); div.textContent = `${p.name} × ${qty} — $${(p.price*qty).toFixed(2)}`
    summary.appendChild(div)
  }
})

qs('#close-checkout').addEventListener('click', ()=> qs('#checkout-modal').hidden = true)

qs('#checkout-form').addEventListener('submit', async e=>{
  e.preventDefault();
  const email = qs('#buyer-email').value
  if(!email) return
  try{
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ items: cart, email })
    })
    const data = await res.json()
    if(data.url){ window.location = data.url; return }
    alert(data.error || 'Checkout failed')
  }catch(err){ console.error(err); alert('Checkout error') }
})

// Account modal logic
qs('#account-btn').addEventListener('click', ()=>{ qs('#auth-modal').hidden = false; updateAuthUI() })
qs('#close-auth').addEventListener('click', ()=> qs('#auth-modal').hidden = true)

async function updateAuthUI(){
  const loggedIn = !!token
  qs('#logged-in').hidden = !loggedIn
  qs('#logged-out').hidden = loggedIn
  if(loggedIn){
    try{ const res = await fetch('/api/me', { headers: { 'Authorization':'Bearer '+token }}); if(res.ok){ const d=await res.json(); qs('#me-email').textContent = d.user.email }else{ token=null; localStorage.removeItem('bemu_token'); updateAuthUI() } }catch(e){ console.error(e) }
  }
}

qs('#login-btn').addEventListener('click', async ()=>{
  const email = qs('#login-email').value, password = qs('#login-pass').value
  const res = await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})})
  const d = await res.json()
  if(d.token){ token = d.token; localStorage.setItem('bemu_token', token); updateAuthUI(); alert('Logged in') } else { alert(d.error||'Login failed') }
})

qs('#reg-btn').addEventListener('click', async ()=>{
  const email = qs('#reg-email').value, password = qs('#reg-pass').value
  const res = await fetch('/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})})
  const d = await res.json()
  if(d.token){ token = d.token; localStorage.setItem('bemu_token', token); updateAuthUI(); alert('Registered and logged in') } else { alert(d.error||'Register failed') }
})

qs('#logout-btn').addEventListener('click', ()=>{ token=null; localStorage.removeItem('bemu_token'); updateAuthUI(); qs('#auth-modal').hidden=true })

// product modal handlers
function openProductModal(id){
  const p = products.find(x=>x.id===Number(id)); if(!p) return
  qs('#pm-img').src = p.img
  qs('#pm-name').textContent = p.name
  qs('#pm-desc').textContent = p.desc
  qs('#pm-price').textContent = `$${p.price.toFixed(2)}`
  qs('#pm-add').dataset.id = p.id
  qs('#product-modal').hidden = false
}
qs('#close-product').addEventListener('click', ()=> qs('#product-modal').hidden = true)
qs('#pm-add').addEventListener('click', e=>{ const id = e.target.dataset.id; addToCart(Number(id)); qs('#product-modal').hidden = true })

// handle checkout success in URL: clear cart and show banner
function handleUrlSuccess(){
  const params = new URLSearchParams(window.location.search)
  if(params.get('success')==='1'){
    const orderId = params.get('order')
    // clear cart
    cart = {}; saveCart();
    // show banner
    const b = qs('#success-banner'); b.textContent = `Thanks! Order #${orderId} received — check your email.`
    b.style.display = 'block'
    setTimeout(()=> b.style.display = 'none', 8000)
    // remove params from URL
    history.replaceState(null,'',window.location.pathname)
  }
}

// prefill buyer email when user logged in
setInterval(()=>{
  if(token){ fetch('/api/me', { headers:{ 'Authorization':'Bearer '+token } }).then(r=>r.json()).then(d=>{ if(d && d.user) qs('#buyer-email').value = d.user.email }).catch(()=>{}) }
}, 2000)

init()
const PRODUCTS_URL = '/api/products'
const qs = s=>document.querySelector(s)
let products = []
let cart = JSON.parse(localStorage.getItem('bemu_cart')||'{}')
let token = localStorage.getItem('bemu_token') || null

function saveCart(){ localStorage.setItem('bemu_cart', JSON.stringify(cart)); renderCartCount(); renderCartItems(); }

function renderProducts(){
  const container = qs('#products')
  container.innerHTML = ''
  products.forEach(p=>{
    const el = document.createElement('article')
    el.className = 'product'
    el.innerHTML = `
      <img src="${p.img}" alt="${p.name}" />
      <h4>${p.name}</h4>
      <p>${p.desc}</p>
      <div class="meta"><strong>$${p.price.toFixed(2)}</strong><button class="btn add" data-id="${p.id}">Add</button></div>
    `
    container.appendChild(el)
  })
  container.addEventListener('click', e=>{
    const btn = e.target.closest('.add'); if(!btn) return
    const id = btn.dataset.id
    addToCart(Number(id))
  })
}

function addToCart(id){ cart[id] = (cart[id]||0)+1; saveCart() }

function removeFromCart(id){ delete cart[id]; saveCart() }

function changeQty(id, delta){ cart[id] = Math.max(0,(cart[id]||0)+delta); if(cart[id]===0) delete cart[id]; saveCart() }

function renderCartCount(){
  const count = Object.values(cart).reduce((s,n)=>s+n,0)
  qs('#cart-count').textContent = count
}

function renderCartItems(){
  const list = qs('#cart-items'); list.innerHTML = ''
  let total = 0
  for(const [idStr, qty] of Object.entries(cart)){
    const p = products.find(x=>x.id===Number(idStr))
    if(!p) continue
    total += p.price*qty
    const li = document.createElement('li')
    li.innerHTML = `
      <div>${p.name} × ${qty}</div>
      <div>
        <button data-id="${p.id}" class="small sub">-</button>
        <button data-id="${p.id}" class="small add">+</button>
        <button data-id="${p.id}" class="small rem">✕</button>
      </div>
    `
    list.appendChild(li)
  }
  qs('#cart-total').textContent = total.toFixed(2)
}

async function init(){
  try{
    products = await (await fetch(PRODUCTS_URL)).json()
  }catch(e){ products = [] }
  renderProducts(); renderCartCount(); renderCartItems();
}

// UI controls
qs('#cart-btn').addEventListener('click', ()=> qs('#cart-panel').hidden = !qs('#cart-panel').hidden)
qs('#close-cart').addEventListener('click', ()=> qs('#cart-panel').hidden = true)
qs('#cart-items').addEventListener('click', e=>{
  const id = e.target.dataset.id; if(!id) return
  if(e.target.classList.contains('add')) changeQty(Number(id),1)
  if(e.target.classList.contains('sub')) changeQty(Number(id),-1)
  if(e.target.classList.contains('rem')) removeFromCart(Number(id))
})

qs('#checkout-btn').addEventListener('click', ()=>{
  qs('#checkout-modal').hidden = false
  const summary = qs('.order-summary');
  summary.innerHTML = ''
  for(const [id,qty] of Object.entries(cart)){
    const p = products.find(x=>x.id===Number(id))
    if(!p) continue
    const div = document.createElement('div'); div.textContent = `${p.name} × ${qty} — $${(p.price*qty).toFixed(2)}`
    summary.appendChild(div)
  }
})

qs('#close-checkout').addEventListener('click', ()=> qs('#checkout-modal').hidden = true)

qs('#checkout-form').addEventListener('submit', async e=>{
  e.preventDefault();
  const email = qs('#buyer-email').value
  if(!email) return
  // send cart to server to create Stripe Checkout session
  try{
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ items: cart, email })
    })
    const data = await res.json()
    if(data.url){ window.location = data.url; return }
    alert(data.error || 'Checkout failed')
  }catch(err){
    console.error(err); alert('Checkout error')
  }
})

// Account modal logic
qs('#account-btn').addEventListener('click', ()=>{
  qs('#auth-modal').hidden = false
  updateAuthUI()
})
qs('#close-auth').addEventListener('click', ()=> qs('#auth-modal').hidden = true)

async function updateAuthUI(){
  const loggedIn = !!token
  qs('#logged-in').hidden = !loggedIn
  qs('#logged-out').hidden = loggedIn
  if(loggedIn){
    try{ const res = await fetch('/api/me', { headers: { 'Authorization':'Bearer '+token }}); if(res.ok){ const d=await res.json(); qs('#me-email').textContent = d.user.email }else{ token=null; localStorage.removeItem('bemu_token'); updateAuthUI() } }catch(e){ console.error(e) }
  }
}

qs('#login-btn').addEventListener('click', async ()=>{
  const email = qs('#login-email').value, password = qs('#login-pass').value
  const res = await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})})
  const d = await res.json()
  if(d.token){ token = d.token; localStorage.setItem('bemu_token', token); updateAuthUI(); alert('Logged in') } else { alert(d.error||'Login failed') }
})

qs('#reg-btn').addEventListener('click', async ()=>{
  const email = qs('#reg-email').value, password = qs('#reg-pass').value
  const res = await fetch('/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})})
  const d = await res.json()
  if(d.token){ token = d.token; localStorage.setItem('bemu_token', token); updateAuthUI(); alert('Registered and logged in') } else { alert(d.error||'Register failed') }
})

qs('#logout-btn').addEventListener('click', ()=>{ token=null; localStorage.removeItem('bemu_token'); updateAuthUI(); qs('#auth-modal').hidden=true })

// prefill buyer email when user logged in
setInterval(()=>{
  if(token){ fetch('/api/me', { headers:{ 'Authorization':'Bearer '+token } }).then(r=>r.json()).then(d=>{ if(d && d.user) qs('#buyer-email').value = d.user.email }).catch(()=>{}) }
}, 2000)

init()
