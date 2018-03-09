const _ = require('lodash')
const { pgTypes } = require('./db')

const getSchemaForTable = async (pool, table) => {
  const res = await pool.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='${table}'`)
  //console.log(res.rows)
  return res.rows
}

const updateSchemaForTable = async (pool, type) => {
  console.log('Maybe updating ', type.table)
  const schema = await getSchemaForTable(pool, type.table)
  //console.log(schema)
  // TODO: remove unused columns if configured to do so!

  // add missing columns
  for (let i = 0; i < type.properties.length; i++) {
    const name = _.keys(type.properties[i])[0]
    const def = type.properties[i][name]
    const exists = schema.find(row => row.column_name === name)
    if (!exists) {
      console.error(`! Cannot find column: ${name} in table ${type.table}`)
      console.log('Adding new column to database...')
      let nativeType
      let defs
      if (typeof def === 'string') {
        nativeType = def
      } else {
        nativeType = def.type
        console.log('extra stuff: ', def)
      }

      const dataType = pgTypes[nativeType]
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
