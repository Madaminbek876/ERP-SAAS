type Handler = () => void

class WarehouseEvents {
  private handlers = new Set<Handler>()

  subscribe(handler: Handler) {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  emit() {
    for (const h of this.handlers) h()
  }
}

export const warehouseEvents = new WarehouseEvents()
