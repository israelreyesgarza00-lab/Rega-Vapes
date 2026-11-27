const { createHash, timingSafeEqual } = require('node:crypto')
const { Pool } = require('pg')
const Excel = require('exceljs')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
const paymentMethods = ['Transferencia', 'Efectivo', 'Tarjeta']
const hash = value => createHash('sha256').update(value).digest()
const integer = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max
const productId = value => /^\d{1,18}$/.test(String(value))
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
const money = value => typeof value === 'string' && /^\d{1,10}(\.\d{1,2})?$/.test(value)
const name = value =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function today() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Mexico_City'
  }).format(new Date())
}

async function transaction(work, begin = 'BEGIN') {
  const client = await pool.connect()
  try {
    await client.query(begin)
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function getReport(client, start, duration) {
  const period = `
    s.cancelled_at IS NULL AND
    s.sold_on >= $1::date AND s.sold_on < $1::date + $2::interval`
  const params = [start, duration]

  const sales = await client.query(`
    SELECT s.id, s.sold_on::text AS date, p.model, p.flavor, s.units,
           s.unit_price, s.units * s.unit_price AS total,
           s.payment_method, s.unit_cost,
           s.units * s.unit_cost AS cost_total,
           s.units * (s.unit_price - s.unit_cost) AS margin
    FROM panel_sales s
    JOIN panel_products p ON p.id = s.product_id
    WHERE ${period}
    ORDER BY s.sold_on DESC, s.id
  `, params)

  const ranking = await client.query(`
    SELECT min(p.flavor) AS flavor, sum(s.units)::int AS units
    FROM panel_sales s
    JOIN panel_products p ON p.id = s.product_id
    WHERE ${period}
    GROUP BY lower(p.flavor)
    ORDER BY units DESC, flavor
  `, params)

  const balance = await client.query(`
    SELECT coalesce(sum(s.units * s.unit_price), 0) AS revenue,
           coalesce(sum(s.units * s.unit_cost), 0) AS recorded_cost,
           coalesce(sum(s.units * (s.unit_price - s.unit_cost)), 0) AS recorded_margin,
           count(*) FILTER (WHERE s.unit_cost IS NULL)::int AS missing_cost,
           coalesce(sum(s.units * s.unit_price)
             FILTER (WHERE s.unit_cost IS NULL), 0) AS revenue_without_cost
    FROM panel_sales s
    WHERE ${period}
  `, params)

  const payments = await client.query(`
    SELECT coalesce(s.payment_method, 'Sin registrar') AS method,
           sum(s.units * s.unit_price) AS total
    FROM panel_sales s
    WHERE ${period}
    GROUP BY 1
    ORDER BY 1
  `, params)

  return {
    sales: sales.rows,
    ranking: ranking.rows,
    balance: balance.rows[0],
    payments: payments.rows
  }
}

async function sendExcel(res, file, report) {
  const workbook = new Excel.Workbook()
  const amount = value => value == null ? null : Number(value)
  const format = '#,##0.00'

  const sales = workbook.addWorksheet('Ventas')
  sales.columns = [
    { header: 'Fecha', width: 14 },
    { header: 'Modelo', width: 28 },
    { header: 'Sabor', width: 30 },
    { header: 'Unidades', width: 13 },
    { header: 'Precio unitario', width: 18, style: { numFmt: format } },
    { header: 'Importe', width: 18, style: { numFmt: format } },
    { header: 'Método de pago', width: 20 },
    ...['Costo unitario', 'Costo de venta', 'Margen bruto'].map(header => ({
      header, width: 18, style: { numFmt: format }
    }))
  ]
  sales.addRows(report.sales.map(row => [
    row.date, row.model, row.flavor, row.units,
    amount(row.unit_price), amount(row.total), row.payment_method ?? 'Sin registrar',
    amount(row.unit_cost), amount(row.cost_total), amount(row.margin)
  ]))

  const ranking = workbook.addWorksheet('Ranking')
  ranking.columns = [
    { header: 'Sabor', width: 30 },
    { header: 'Unidades vendidas', width: 22 }
  ]
  ranking.addRows(report.ranking.map(row => [row.flavor, row.units]))

  const balance = workbook.addWorksheet('Balance')
  balance.columns = [
    { header: 'Concepto', width: 45 },
    { header: 'Valor', width: 20 }
  ]
  const figures = report.balance
  balance.addRows([
    ['Ventas totales', amount(figures.revenue)],
    ['Costo de ventas con costo registrado', amount(figures.recorded_cost)],
    ['Margen bruto de ventas con costo', amount(figures.recorded_margin)],
    ['Ventas sin costo registrado', figures.missing_cost],
    ['Importe de ventas sin costo registrado', amount(figures.revenue_without_cost)]
  ])
  for (const row of [2, 3, 4, 6]) balance.getCell(row, 2).numFmt = format

  const payments = workbook.addWorksheet('Métodos de pago')
  payments.columns = [
    { header: 'Método', width: 24 },
    { header: 'Importe', width: 20, style: { numFmt: format } }
  ]
  const totals = new Map(report.payments.map(row => [row.method, amount(row.total)]))
  for (const method of [...paymentMethods, 'Sin registrar']) {
    payments.addRow([method, totals.get(method) ?? 0])
  }

  for (const sheet of [sales, ranking, balance, payments]) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.getRow(1).font = { bold: true }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${file}.xlsx"`)
  return res.end(Buffer.from(buffer))
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const password = process.env.PANEL_PASSWORD
  if (!password || !process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Faltan las variables del panel en Vercel.' })
  }

  const expected = 'Basic ' + Buffer.from('admin:' + password).toString('base64')
  if (!timingSafeEqual(hash(req.headers.authorization || ''), hash(expected))) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Panel Rega", charset="UTF-8"')
    return res.status(401).json({ error: 'Acceso privado.' })
  }

  const { action, day, week, month, year, days } = req.query
  try {
    if (req.method === 'GET' && ['overview', 'excel'].includes(action)) {
      const choices = [
        [day, day, '1 day', 'dia'],
        [week, week, '7 days', 'semana'],
        [month, `${month}-01`, '1 month', 'mes'],
        [year, `${year}-01-01`, '1 year', 'anio']
      ].filter(([value]) => value !== undefined)
      const [value, start, duration, label] = choices[0] || []
      if (choices.length !== 1 || typeof value !== 'string' || !validDate(start)
          || (week !== undefined && new Date(start).getUTCDay() !== 1)) {
        return res.status(400).json({ error: 'Selecciona un periodo válido para el reporte.' })
      }

      const leadTime = Number(days ?? 7)
      if (!integer(leadTime, 1, 90)) {
        return res.status(400).json({ error: 'El plazo debe ser de 1 a 90 días.' })
      }

      const report = await transaction(async client => {
        const data = await getReport(client, start, duration)
        if (action === 'overview') {
          const products = await client.query(`
            SELECT p.id, p.model, p.flavor, p.stock, p.order_quantity, m.unit_cost, m.retail_price,
                   coalesce(sum(s.units), 0)::int AS recent_units,
                   greatest(0, ceil(coalesce(sum(s.units), 0) * $1::numeric / 28)
                     - p.stock)::int AS suggested
            FROM panel_products p
            LEFT JOIN panel_sales s ON s.product_id = p.id AND s.cancelled_at IS NULL
              AND s.sold_on BETWEEN $2::date - 27 AND $2::date
            LEFT JOIN panel_model_costs m ON m.model_key = lower(btrim(p.model))
            GROUP BY p.id, m.unit_cost, m.retail_price
            ORDER BY suggested DESC, p.model, p.flavor
          `, [leadTime, today()])
          data.products = products.rows
        }
        return data
      }, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')

      if (action === 'excel') return await sendExcel(res, `ventas-${label}-${value}`, report)
      return res.json(report)
    }

    if (req.method !== 'POST' || !req.headers['content-type']?.startsWith('application/json')) {
      return res.status(405).json({ error: 'Operación no disponible.' })
    }

    const {
      id, product, model, flavor, stock, quantity, date, units, price,
      cost, retailPrice, payment, expectedCost
    } = req.body || {}

    if (action === 'product' && name(model) && name(flavor) && integer(stock, 0, 1000000)) {
      await pool.query(
        'INSERT INTO panel_products (model, flavor, stock) VALUES ($1, $2, $3)',
        [model.trim(), flavor.trim(), stock]
      )
      return res.status(201).json({ ok: true })
    }

    if (action === 'stock' && productId(product) && integer(stock, 0, 1000000)) {
      const result = await pool.query(
        'UPDATE panel_products SET stock = $2 WHERE id = $1', [product, stock]
      )
      return result.rowCount
        ? res.json({ ok: true })
        : res.status(404).json({ error: 'Producto no encontrado.' })
    }

    if (action === 'order' && productId(product)
        && (quantity === null || integer(quantity, 0, 1000000))) {
      const result = await pool.query(
        'UPDATE panel_products SET order_quantity = $2 WHERE id = $1', [product, quantity]
      )
      return result.rowCount
        ? res.json({ ok: true })
        : res.status(404).json({ error: 'Producto no encontrado.' })
    }

    if (action === 'cost' && productId(product) && money(cost)
        && (retailPrice === undefined || retailPrice === '' || money(retailPrice))) {
      const result = await pool.query(`
        INSERT INTO panel_model_costs (model_key, unit_cost, retail_price)
        SELECT lower(btrim(model)), $2::numeric, $3::numeric FROM panel_products WHERE id = $1
        ON CONFLICT (model_key) DO UPDATE
        SET unit_cost = excluded.unit_cost,
            retail_price = CASE WHEN $4::boolean THEN excluded.retail_price
                                ELSE panel_model_costs.retail_price END
      `, [product, cost, retailPrice || null, retailPrice !== undefined])
      return result.rowCount
        ? res.json({ ok: true })
        : res.status(404).json({ error: 'Modelo no encontrado.' })
    }

    if (action === 'cancel' && uuid(id)) {
      const result = await pool.query(`
        WITH cancelled AS (
          UPDATE panel_sales SET cancelled_at = now()
          WHERE id = $1 AND cancelled_at IS NULL
          RETURNING product_id, units
        )
        UPDATE panel_products p SET stock = p.stock + cancelled.units
        FROM cancelled WHERE p.id = cancelled.product_id
      `, [id])

      if (result.rowCount) return res.json({ ok: true })
      const existing = await pool.query('SELECT 1 FROM panel_sales WHERE id = $1', [id])
      return existing.rowCount
        ? res.json({ ok: true, alreadyCancelled: true })
        : res.status(404).json({ error: 'Venta no encontrada.' })
    }

    if (action === 'sale' && productId(product) && validDate(date) && date <= today()
        && integer(units, 1, 1000000) && money(price) && paymentMethods.includes(payment)
        && (expectedCost === null || money(expectedCost)) && uuid(id)) {
      await transaction(async client => {
        const inserted = await client.query(`
          INSERT INTO panel_sales
            (id, sold_on, product_id, units, unit_price, unit_cost, payment_method)
          SELECT $1, $2, p.id, $4, $5, m.unit_cost, $6
          FROM panel_products p
          LEFT JOIN panel_model_costs m ON m.model_key = lower(btrim(p.model))
          WHERE p.id = $3 AND m.unit_cost IS NOT DISTINCT FROM $7::numeric
          ON CONFLICT (id) DO NOTHING RETURNING id
        `, [id, date, product, units, price, payment, expectedCost])

        if (!inserted.rowCount) {
          const prior = await client.query('SELECT 1 FROM panel_sales WHERE id = $1', [id])
          if (!prior.rowCount) throw Object.assign(new Error(), { code: 'COST_CHANGED' })
          return
        }

        const updated = await client.query(`
          UPDATE panel_products SET stock = stock - $2
          WHERE id = $1 AND stock >= $2
        `, [product, units])
        if (!updated.rowCount) throw Object.assign(new Error(), { code: 'LOW_STOCK' })
      })
      return res.status(201).json({ ok: true })
    }

    return res.status(400).json({ error: 'Revisa los datos ingresados.' })
  } catch (error) {
    if (error.code === 'COST_CHANGED') {
      return res.status(409).json({ error: 'Cambió el costo o el producto. Recarga el panel antes de guardar.' })
    }
    if (error.code === 'LOW_STOCK') {
      return res.status(409).json({ error: 'Las unidades superan el stock disponible.' })
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ese modelo y sabor ya existen.' })
    }
    if (error.code === '23503') {
      return res.status(404).json({ error: 'Producto no encontrado.' })
    }
    console.error('Error del panel', error.code || error.name)
    return res.status(500).json({ error: 'No se pudo completar la operación.' })
  }
}
