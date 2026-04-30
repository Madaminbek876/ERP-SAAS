import { translateLooseText, type LooseLanguageCode } from "./loose"

const TEXT_SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
])

const ATTRIBUTE_NAMES = ["placeholder", "title", "aria-label"]

function shouldIgnoreElement(element: Element | null) {
  if (!element) return true
  if (element.closest("[data-i18n-ignore='true']")) return true
  if (element instanceof HTMLElement && element.isContentEditable) return true
  return false
}

function localizeString(value: string, language: LooseLanguageCode) {
  const next = translateLooseText(value, language)
  return typeof next === "string" ? next : value
}

function localizeAttributes(element: Element, language: LooseLanguageCode) {
  if (shouldIgnoreElement(element)) return

  for (const name of ATTRIBUTE_NAMES) {
    const current = element.getAttribute(name)
    if (!current) continue
    const next = localizeString(current, language)
    if (next !== current) {
      element.setAttribute(name, next)
    }
  }

  if (element instanceof HTMLInputElement) {
    const isButtonLike = ["button", "submit", "reset"].includes(element.type)
    if (isButtonLike && element.value) {
      const next = localizeString(element.value, language)
      if (next !== element.value) {
        element.value = next
      }
    }
  }
}

function localizeTextNodes(root: ParentNode, language: LooseLanguageCode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (TEXT_SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (shouldIgnoreElement(parent)) return NodeFilter.FILTER_REJECT
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let current = walker.nextNode()
  while (current) {
    const textNode = current as Text
    const original = textNode.nodeValue ?? ""
    const next = localizeString(original, language)
    if (next !== original) {
      textNode.nodeValue = next
    }
    current = walker.nextNode()
  }
}

export function localizeDomTree(root: ParentNode, language: LooseLanguageCode) {
  if (root instanceof Element) {
    localizeAttributes(root, language)
    root.querySelectorAll("*").forEach((element) => localizeAttributes(element, language))
  } else if (root instanceof Document) {
    root.querySelectorAll("*").forEach((element) => localizeAttributes(element, language))
  }

  localizeTextNodes(root, language)
}
