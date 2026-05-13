export function Blobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="blob gradient-primary" style={{ width: 480, height: 480, top: -120, left: -120 }} />
      <div className="blob gradient-cyan" style={{ width: 420, height: 420, top: "30%", right: -140, animationDelay: "-4s" }} />
      <div className="blob gradient-yellow" style={{ width: 380, height: 380, bottom: -120, left: "30%", animationDelay: "-9s" }} />
      <div className="blob gradient-peach" style={{ width: 320, height: 320, top: "50%", left: "20%", animationDelay: "-12s" }} />
    </div>
  );
}
