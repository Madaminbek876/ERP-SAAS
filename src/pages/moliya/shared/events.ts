type Handler = () => void

class FinanceEvents {
  private handlers = new Set<Handler>()

  subscribe(handler: Handler) {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  emit() {
    for (const handler of this.handlers) handler()
  }
}

export const financeEvents = new FinanceEvents()
