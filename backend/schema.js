const _ = require('lodash')
const { pgTypes } = require('./db')

const getSchemaForTable = async (pool, table) => {
  const res = await pool.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='${table}'`)
  return res.rows
}

const updateSchemaForTable = async (pool, type) => {
  console.log('Maybe updating ', type.table)
  if (type.recreate) {
    console.warn(`! Dropping table ${type.table} because recreate == true`)
    await pool.query(`DROP TABLE ${type.table}`)
  }
  if (type.dumpData) {
    console.warn(`Dumping data of table ${type.table}`)
    const r = await pool.query(`SELECT * FROM ${type.table}`)
    console.log(r.rows)
  }

  const schema = await getSchemaForTable(pool, type.table)
//  console.log(schema)

  if (schema.length === 0) {
    console.error(`! Table ${type.table} does not exist, creating`)
    const sql = `CREATE TABLE ${type.table} (id serial primary key, inserted_at timestamp without time zone, updated_at timestamp without time zone)`
    const result = await pool.query(sql)
  }
  //console.log(schema)
  // TODO: remove unused columns if configured to do so!

  // add missing columns
  for (let i = 0; i < type.properties.length; i++) {
    const name = type.properties[i].name
    const nativeType = type.properties[i].type
    const exists = schema.find(row => row.column_name === name)
    if (!exists) {
      console.error(`! Cannot find column: ${name} in table ${type.table}`)
      console.log('Adding new column to database...')

      const dataType = pgTypes[nativeType]
      // TODO: foreign keys
      const sql = `ALTER TABLE ${type.table} ADD COLUMN ${name} ${dataType}`
      console.log('sql: ', sql)
      const result = await pool.query(sql)
      //console.log(result)
    }
  }
  // character varying
}

module.exports = {
  getSchemaForTable,
  updateSchemaForTable
}
