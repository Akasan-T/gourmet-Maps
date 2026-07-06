function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-card__header">
          <h2>{title}</h2>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>
  )
}

export default Modal
