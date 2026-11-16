import { useId, useRef } from "react";

// Tarjeta pequeña que abre una ventana modal. Mismo estilo que "Aviso a familias" del tablero.
export default function TarjetaModal({ titulo, resumen, cta, superficie = "rg-surface-sky", children }) {
  const dialogo = useRef(null);
  const idTitulo = useId();
  const cerrar = () => dialogo.current?.close();
  // Clic en el fondo oscuro (fuera de la tarjeta) cierra la ventana.
  const clicFondo = (e) => { if (e.target === dialogo.current) cerrar(); };

  return (
    <>
      <button type="button" className={`rg-panel ${superficie} rg-aviso-mini`}
        onClick={() => dialogo.current?.showModal()} aria-haspopup="dialog">
        <span className="rg-panel__title">{titulo}</span>
        <span className="rg-aviso-mini__prev">{resumen}</span>
        <span className="rg-aviso-mini__cta">{cta} →</span>
      </button>

      <dialog ref={dialogo} className="rg-modal" aria-labelledby={idTitulo} onClick={clicFondo}>
        <div className="rg-modal__body rg-aviso">
          <div className="rg-modal__head">
            <h2 id={idTitulo}>{titulo}</h2>
            <button type="button" className="rg-modal__close" onClick={cerrar} aria-label="Cerrar">×</button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
