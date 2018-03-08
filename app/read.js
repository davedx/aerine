

const replaceTemplate = (html, name, value) => {
  let re = new RegExp(/{{.*?}}/g)
  let matches = html.match(re)
  if (!matches) {
    return html
  }
  //console.log(matches)
  for (let i = 0; i < matches.length; i++) {
    const expr = matches[i].replace('{{', '').replace('}}', '').trim()
    const entry = _.get({[name]: value}, `${expr}`)
    html = html.replace(matches[i], entry)
  }
  return html
}

const processFor = (node, data, tFor) => {
  const expr = tFor.split(' in ')
  const iterator = expr[0]
  const dataRoot = expr[1]
  if (data[dataRoot]) {
    //console.log('dataroot length: ', data[dataRoot].length)
    for (let i = 0; i < data[dataRoot].length; i++) {
      const newNode = node.cloneNode()
      let html = node.innerHTML
      newNode.innerHTML = replaceTemplate(html, iterator, data[dataRoot][i])
      newNode.removeAttribute('t-for')
      //console.log('**', data[dataRoot][i])
      newNode.setAttribute('t-id', data[dataRoot][i]['id'])
      //newNode.setAttribute('t-action', dataRoot)
      node.parentNode.appendChild(newNode)
    }
  }
  node.parentNode.removeChild(node)
}

const processNodes = (node, data) => {
  const attrs = node.attributes
  if (attrs['t-for']) {
    processFor(node, data, node.getAttribute('t-for'))
  } else {
    const children = node.content ? node.content.children : node.children
    const len = children.length
    for (let i = 0; i < len; i++) {
      processNodes(children[i], data)
    }
  }
}

const findReferencesInFor = (node, tFor, refs) => {
  const expr = tFor.split(' in ')
  const iterator = expr[0]
  const dataRoot = expr[1]
  const html = node.innerHTML
  const re = new RegExp(/{{.*?}}/g)
  const matches = html.match(re)
  for (let i = 0; i < matches.length; i++) {
    const expr = matches[i].replace('{{', '').replace('}}', '').trim()
    refs.push(`${dataRoot}.${expr}`)
  }
}

const findReferencesInNodes = (node, refs) => {
  const attrs = node.attributes
  if (attrs['t-for']) {
    //console.log('t-for')
    findReferencesInFor(node, node.getAttribute('t-for'), refs)
  }
  const children = node.content ? node.content.children : node.children
  for (let i = 0; i < children.length; i++) {
    findReferencesInNodes(children[i], refs)
  }
}
