const compileStyles = (styleNode) => {
  // TODO: maybe use includePaths?
  // const result = sass.renderSync({
  //   data: styleNode.innerText
  // })
  // console.log(result)

  // styleNode.innerText = result
  return styleNode
}

// FIXME: stop appending same node twice (after navigation)
const injectStyles = (styleNode, domRoot) => {
  const attrs = styleNode.attributes
  let lang = 'css'
  if (attrs['lang']) {
    lang = attrs['lang'].value
  }
  console.log('injectStyles: ', styleNode, domRoot, lang)
  switch (lang) {
    case 'css':
      domRoot.appendChild(styleNode)
      break
    case 'scss':
      const css = compileStyles(styleNode)
      domRoot.appendChild(css)
      break
    default: console.error(`Unsupported style language: ${lang}`)
  }
}
