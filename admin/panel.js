const byId = id => document.getElementById(id)
const sale = byId('sale')
const report = byId('report')
const delivery = byId('delivery')
const adjust = byId('adjust')
const cost = byId('cost')
const search = byId('sale-search')
const stockSearch = byId('stock-search')
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
function reportDate(date) {
  report.elements.day.value = date
  report.elements.week.value = monday(date)
  report.elements.month.value = date.slice(0, 7)
  report.elements.year.value = date.slice(0, 4)
}

reportDate(today)

function activePeriod() {
  const key = report.elements.period.value
  const value = report.elements[key].value
  return { [key]: key === 'week' ? monday(value) : value }
}

report.elements.period.addEventListener('change', () => {
  for (const key of ['day', 'week', 'month', 'year']) {
    const active = key === report.elements.period.value
    byId('report-' + key).hidden = !active
    report.elements[key].disabled = !active
  }
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

function matchingProducts(value) {
  const words = searchKey(value).split(/\s+/).filter(Boolean)
  return products.filter(row =>
    words.every(word => searchKey(productLabel(row)).includes(word))
  )
}

function fillSaleOptions() {
  const matches = matchingProducts(search.value)
  fillOptions(sale, matches, productLabel, matches.length ? 'Selecciona un producto' : 'Sin coincidencias')
  if (search.value.trim() && matches.length === 1) {
    sale.elements.product.value = String(matches[0].id)
  }
  showSaleCost()
}

function showModelCost() {
  cost.elements.cost.value = selectedProduct(cost)?.unit_cost ?? ''
}

search.addEventListener('input', fillSaleOptions)
sale.elements.product.addEventListener('change', showSaleCost)
sale.elements.price.addEventListener('input', showSaleCost)
cost.elements.product.addEventListener('change', showModelCost)

function renderInventory() {
  const searchValue = stockSearch.value.trim()
  const matches = searchValue ? matchingProducts(searchValue) : []
  const visible = matches.slice(0, 50)
  byId('stock-results').textContent = matches.length > visible.length
    ? `Mostrando ${visible.length} de ${matches.length} resultados. Afina tu búsqueda.` : ''
  renderRows('stock', visible.map(row => [
    row.model, row.flavor, row.stock, row.recent_units, row.suggested, orderInput(row)
  ]), searchValue ? 'Sin coincidencias.' : 'Escribe un modelo o sabor para ver el inventario.', 6)
}

stockSearch.addEventListener('input', renderInventory)

function cancelButton(row) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Anular'
  button.setAttribute('aria-label', `Anular venta de ${row.model} / ${row.flavor} del ${row.date}`)
  button.addEventListener('click', async () => {
    if (!window.confirm(`¿Anular la venta de ${row.units} unidad(es) de ${row.model} / ${row.flavor}? Se devolverán al stock.`)) return
    button.disabled = true
    try {
      await request('cancel', { id: row.id })
    } catch (error) {
      message(error.message, true)
      button.disabled = false
      return
    }
    message('Venta anulada. Se devolvieron las unidades al stock.')
    try {
      await refresh()
    } catch {
      message('Venta anulada. Recarga el panel para ver el stock actualizado.')
    }
  })
  return button
}

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
  const [key, value] = Object.entries(period)[0]
  const title = `${{ day: 'Día', week: 'Semana del', month: 'Mes', year: 'Año' }[key]} ${value}`
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
    row.margin == null ? '—' : currency.format(row.margin), cancelButton(row)
  ]), 'Aún no hay ventas en este periodo.', 9)

  products = data.products
  renderInventory()

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
        reportDate(body.date)
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
