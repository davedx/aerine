const _ = require('lodash')
const { pgTypes } = require('./db')

const getSchemaForTable = async (pool, table) => {
  const res = await pool.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='${table}'`)
  return res.rows
}

const updateSchemaForTable = async (pool, type) => {
  console.log('Maybe updating ', type.table)
  const schema = await getSchemaForTable(pool, type.table)

  if (schema.length === 0) {
    console.error(`! Table ${type.table} does not exist, creating`)
    const sql = `CREATE TABLE ${type.table} ()`
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
