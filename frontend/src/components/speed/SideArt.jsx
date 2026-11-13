import Image from "next/image";

/* Side slots of the speed-test page (xl screens and up). Drop an image path into LEFT_IMG / RIGHT_IMG (files in
   /public/speed/) and it appears here; while null, the slot is just empty space. */
const LEFT_IMG = null;   // e.g. "/speed/left.png"
const RIGHT_IMG = null;  // e.g. "/speed/right.png"

function Slot({ src, alt }) {
  return (
    <aside aria-hidden={src ? undefined : "true"} className="relative hidden min-h-[420px] place-items-center xl:grid">
      {src && <Image src={src} alt={alt} width={420} height={640} className="h-auto max-h-[560px] w-full object-contain" priority />}
    </aside>
  );
}

export const SideArtLeft = () => <Slot src={LEFT_IMG} alt="" />;
export const SideArtRight = () => <Slot src={RIGHT_IMG} alt="" />;
