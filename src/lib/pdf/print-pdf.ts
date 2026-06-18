import type jsPDF from "jspdf";

export function printPDF(doc: jsPDF) {
  const output = doc.output("bloburl");
  const url = typeof output === "string" ? output : output.href;
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
  );
  iframe.src = url;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    iframe.remove();
    URL.revokeObjectURL(url);
  };

  iframe.onload = () => {
    const printWindow = iframe.contentWindow;
    if (!printWindow) {
      cleanup();
      return;
    }

    printWindow.focus();
    printWindow.print();

    printWindow.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 60_000);
  };

  document.body.appendChild(iframe);
}
