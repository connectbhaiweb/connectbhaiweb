/* Modal + toast host. The legacy views fill #mbox / #toast imperatively (openModal(html), toast(msg)), so React renders
   these elements once and never reconciles their children. */
export default function Overlays() {
  return (
    <>
      <div className="modal" id="modal" hidden role="dialog" aria-modal="true">
        <div className="mbox" id="mbox" />
      </div>
      <div className="toast" id="toast" role="status" hidden />
    </>
  );
}
