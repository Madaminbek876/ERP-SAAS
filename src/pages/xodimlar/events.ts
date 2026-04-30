type Handler = () => void

class PartnerEvents {
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

export const partnerEvents = new PartnerEvents()
