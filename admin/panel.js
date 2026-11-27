const byId = id => document.getElementById(id)
const sale = byId('sale')
const report = byId('report')
const delivery = byId('delivery')
const adjust = byId('adjust')
const cost = byId('cost')
const search = byId('sale-search')
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' })
  .format(new Date())

let products = []
let refreshId = 0
let pendingSale

const modelKey = value => value.trim().toLowerCase()
const searchKey = value => modelKey(value).normalize('NFD').replace(/\p{M}/gu, '')
const productLabel = row => `${row.model} / ${row.flavor}`
const selectedProduct = form => products.find(row => String(row.id) === form.elements.product.value)

function monday(value) {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return date.toISOString().slice(0, 10)
}

sale.elements.date.value = today
sale.elements.date.max = today
report.elements.week.value = monday(today)
report.elements.month.value = today.slice(0, 7)

function activePeriod() {
  return report.elements.period.value === 'month'
    ? { month: report.elements.month.value }
    : { week: monday(report.elements.week.value) }
}

report.elements.period.addEventListener('change', () => {
  const monthly = report.elements.period.value === 'month'
  byId('report-month').hidden = !monthly
  byId('report-week').hidden = monthly
  report.elements.month.disabled = !monthly
  report.elements.week.disabled = monthly
  report.requestSubmit()
})

function message(text, error = false) {
  const status = byId('status')
  status.textContent = text
  status.dataset.error = String(error)
}

async function request(action, body) {
  const query = new URLSearchParams({ action })
  if (!body) {
    for (const [key, value] of Object.entries(activePeriod())) query.set(key, value)
    query.set('days', delivery.elements.days.value)
  }
  const response = await fetch('/api/panel?' + query, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  } : undefined)

  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    throw new Error(data?.error || `No se pudo completar la operación (${response.status}).`)
  }
  return data
}

function renderRows(id, values, emptyText, columns) {
  const body = byId(id)
  body.replaceChildren()
  if (!values.length) {
    const cell = body.insertRow().insertCell()
    cell.colSpan = columns
    cell.textContent = emptyText
    return
  }

  for (const valuesForRow of values) {
    const row = body.insertRow()
    for (const value of valuesForRow) {
      const cell = row.insertCell()
      if (value instanceof HTMLElement) cell.append(value)
      else cell.textContent = value
    }
  }
}

function orderInput(product) {
  const input = document.createElement('input')
  input.type = 'number'
  input.min = '0'
  input.max = '1000000'
  input.step = '1'
  input.setAttribute('aria-label', `Cantidad a pedir de ${productLabel(product)}`)
  let saved = product.order_quantity
  input.value = saved ?? product.suggested

  input.addEventListener('change', async () => {
    if (!input.reportValidity()) return
    const quantity = input.value === '' ? null : Number(input.value)
    input.disabled = true
    try {
      await request('order', { product: product.id, quantity })
      saved = quantity
      message(quantity === null ? 'Sugerencia restablecida.' : 'Cantidad a pedir guardada.')
    } catch (error) {
      message(error.message, true)
    } finally {
      input.value = saved ?? product.suggested
      input.disabled = false
    }
  })
  return input
}

function showSaleCost() {
  const product = selectedProduct(sale)
  const output = byId('sale-cost')
  if (!product) {
    output.textContent = ''
    return
  }
  const price = sale.elements.price.value
  const unitCost = product.unit_cost
  const margin = unitCost != null && price !== ''
    ? ` · Margen bruto por unidad ${currency.format(Number(price) - Number(unitCost))}`
    : ''
  output.textContent =
    `Stock ${product.stock} · Costo unitario ${unitCost == null ? 'sin registrar' : currency.format(unitCost)}${margin}`
}

function fillOptions(form, options, label, placeholder = 'Selecciona un producto') {
  const select = form.elements.product
  const previous = select.value
  select.replaceChildren(new Option(placeholder, ''))
  for (const row of options) select.add(new Option(label(row), row.id))
  if (options.some(row => String(row.id) === previous)) select.value = previous
  if (!form.dataset.saving) form.querySelector('button').disabled = !options.length
}

function fillSaleOptions() {
  const words = searchKey(search.value).split(/\s+/).filter(Boolean)
  const matches = products.filter(row =>
    words.every(word => searchKey(productLabel(row)).includes(word))
  )
  fillOptions(sale, matches, productLabel, matches.length ? 'Selecciona un producto' : 'Sin coincidencias')
  showSaleCost()
}

function showModelCost() {
  cost.elements.cost.value = selectedProduct(cost)?.unit_cost ?? ''
}

search.addEventListener('input', fillSaleOptions)
sale.elements.product.addEventListener('change', showSaleCost)
sale.elements.price.addEventListener('input', showSaleCost)
cost.elements.product.addEventListener('change', showModelCost)

async function refresh() {
  if (!report.reportValidity() || !delivery.reportValidity()) return

  const current = ++refreshId
  const period = activePeriod()
  const data = await request('overview')
  if (current !== refreshId) return

  const download = byId('export')
  download.href = '/api/panel?' + new URLSearchParams({ action: 'excel', ...period })
  download.hidden = false

  const units = data.sales.reduce((sum, row) => sum + row.units, 0)
  const figures = data.balance
  const title = period.month ? `Mes ${period.month}` : `Semana del ${period.week}`
  const missing = figures.missing_cost ? ` · ${figures.missing_cost} ventas sin costo registrado` : ''
  byId('summary').textContent =
    `${title} · ${units} unidades · Ventas ${currency.format(figures.revenue)} · ` +
    `Costo registrado ${currency.format(figures.recorded_cost)} · ` +
    `Margen bruto registrado ${currency.format(figures.recorded_margin)}${missing}`

  renderRows('ranking', data.ranking.map(row => [row.flavor, row.units]),
    'Aún no hay ventas en este periodo.', 2)

  renderRows('sales', data.sales.map(row => [
    row.date, row.model, row.flavor, row.units, currency.format(row.total),
    row.payment_method ?? 'Sin registrar',
    row.cost_total == null ? '—' : currency.format(row.cost_total),
    row.margin == null ? '—' : currency.format(row.margin)
  ]), 'Aún no hay ventas en este periodo.', 8)

  products = data.products
  renderRows('stock', products.map(row => [
    row.model, row.flavor, row.stock, row.recent_units, row.suggested, orderInput(row)
  ]), 'Agrega un producto para empezar.', 6)

  fillSaleOptions()
  fillOptions(adjust, products, productLabel)
  const models = [...new Map(products.map(row => [modelKey(row.model), row])).values()]
    .sort((a, b) => a.model.localeCompare(b.model, 'es-MX'))
  fillOptions(cost, models, row => row.model, 'Selecciona un modelo')
  showModelCost()
}

for (const form of [report, delivery]) {
  form.addEventListener('submit', async event => {
    event.preventDefault()
    try {
      await refresh()
      message('')
    } catch (error) {
      message(error.message, true)
    }
  })
}

for (const [form, action, success] of [
  [sale, 'sale', 'Venta guardada.'],
  [byId('product'), 'product', 'Producto agregado.'],
  [adjust, 'stock', 'Existencias actualizadas.'],
  [cost, 'cost', 'Costo actualizado para todos los sabores del modelo.']
]) {
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (form.dataset.saving) return

    const button = form.querySelector('button')
    button.disabled = true
    form.dataset.saving = 'true'

    try {
      const body = Object.fromEntries(new FormData(form))
      for (const field of ['units', 'stock']) {
        if (field in body) body[field] = Number(body[field])
      }

      if (action === 'sale') {
        body.expectedCost = selectedProduct(sale)?.unit_cost ?? null
        const signature = JSON.stringify(body)
        if (pendingSale?.signature !== signature) {
          pendingSale = { signature, id: crypto.randomUUID() }
        }
        body.id = pendingSale.id
      }

      await request(action, body)

      if (action === 'sale') {
        pendingSale = undefined
        form.elements.units.value = '1'
        report.elements.week.value = monday(body.date)
        report.elements.month.value = body.date.slice(0, 7)
      }
      if (action === 'product') form.reset()
      message(success)

      try {
        await refresh()
      } catch {
        message(success + ' Recarga el panel para ver los datos actualizados.')
      }
    } catch (error) {
      message(error.message, true)
    } finally {
      delete form.dataset.saving
      button.disabled = false
    }
  })
}

refresh().catch(error => message(error.message, true))
