const compileStyles = (styleNode) => {
  // TODO: maybe use includePaths?
  // const result = sass.renderSync({
  //   data: styleNode.innerText
  // })
  // console.log(result)

  // styleNode.innerText = result
  return styleNode
}

const injectStyles = (name, styleNode, styleRoot) => {
  const tagId = `styles-${name}`
  // prevent adding it twice
  if (document.getElementById(tagId)) {
    return
  }
  styleNode.id = tagId

  const attrs = styleNode.attributes
  let lang = 'css'
  if (attrs['lang']) {
    lang = attrs['lang'].value
  }
  console.log('injectStyles: ', styleNode, styleRoot, lang)
  switch (lang) {
    case 'css':
      styleRoot.appendChild(styleNode)
      break
    case 'scss':
      const css = compileStyles(styleNode)
      styleRoot.appendChild(css)
      break
    default: console.error(`Unsupported style language: ${lang}`)
  }
}
