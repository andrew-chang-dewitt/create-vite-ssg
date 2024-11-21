/**
 * example: dom manipulation w/ PageData
 * page data will be made available from frontmatter like so:
 */

const data = document.pageData
console.info("data fetched:")
console.dir(data)
const keywords = data?.keywords!
const tagsEl = document.querySelector("#tags")!

const ul = document.createElement("ul")
for (const kw of keywords) {
  const li: HTMLLIElement = document.createElement("li")
  li.textContent = kw
  ul.appendChild(li)
}

tagsEl.appendChild(ul)
