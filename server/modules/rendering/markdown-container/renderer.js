const mdContainer = require('markdown-it-container')

// ------------------------------------
// Markdown - Containers
// ------------------------------------

const containerTypes = ['shellout', 'info', 'warning', 'success', 'danger', 'tip']

module.exports = {
  init (md, conf) {
    for (const name of containerTypes) {
      if (conf[name] === false) { continue }
      md.use(mdContainer, name, {
        render (tokens, idx) {
          const token = tokens[idx]
          if (token.nesting === 1) {
            // Hide inner paragraph tags so the content sits directly inside <pre>,
            // and replace softbreaks with literal newlines (no <br>) since <pre> preserves whitespace.
            for (let i = idx + 1; i < tokens.length; i++) {
              const t = tokens[i]
              if (t.type === `container_${name}_close` && t.level === token.level) { break }
              if ((t.type === 'paragraph_open' || t.type === 'paragraph_close') && t.level === token.level + 1) {
                t.hidden = true
              }
              if (t.type === 'inline' && t.children) {
                for (const child of t.children) {
                  if (child.type === 'softbreak' || child.type === 'hardbreak') {
                    child.type = 'text'
                    child.content = '\n'
                    child.tag = ''
                  }
                }
              }
            }
            const title = token.info.trim().slice(name.length).trim()
            return `<div class="md-container md-container-${name}">` +
              (title ? `<div class="md-container-title">${md.utils.escapeHtml(title)}</div>\n` : '') +
              '<pre>'
          }
          return '</pre></div>\n'
        }
      })
    }
  }
}
