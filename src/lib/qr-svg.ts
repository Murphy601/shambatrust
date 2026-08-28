import { renderSVG } from "uqr";

export function emergencyQrSvg(url: string): string {
  return renderSVG(url, {
    ecc: "M",
    border: 2,
    pixelSize: 6,
    blackColor: "#0B1D3A",
    whiteColor: "#ffffff",
  });
}
