const alertTypes = {
  note: { cssClass: 'is-info', title: 'Note' },
  tip: { cssClass: 'is-success', title: 'Tip' },
  important: { cssClass: 'is-important', title: 'Important' },
  caution: { cssClass: 'is-danger', title: 'Caution' },
  warning: { cssClass: 'is-warning', title: 'Warning' }
}

// Matches [!type] at the start, capturing everything after (<br> or newline or nothing)
const alertPattern = /^\[!(note|tip|important|caution|warning)\](?:<br\s*\/?>)?\n?([\s\S]*)$/i

module.exports = {
  async init ($, config) {
    $('blockquote').each((i, elm) => {
      const firstP = $(elm).children('p').first()
      const match = firstP.html().match(alertPattern)
      if (!match) return

      const alertType = match[1].toLowerCase()
      const remainingHtml = match[2].trim()
      const { cssClass, title } = alertTypes[alertType]

      $(elm).addClass(cssClass).addClass('github-alert')
      if (remainingHtml) {
        firstP.replaceWith(`<p class="alert-title">${title}</p><p>${remainingHtml}</p>`)
      } else {
        firstP.replaceWith(`<p class="alert-title">${title}</p>`)
      }
    })
  }
}
