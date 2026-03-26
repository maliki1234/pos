"use client";
import { useEffect, useRef } from "react";

interface BarcodeLabelProps {
  value: string;
  productName?: string;
  price?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  showText?: boolean;
}

export function BarcodeLabel({
  value,
  productName,
  price,
  width = 2,
  height = 60,
  fontSize = 14,
  showText = true,
}: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width,
          height,
          fontSize,
          displayValue: showText,
          margin: 8,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch {
        // invalid barcode value — leave svg blank
      }
    });
  }, [value, width, height, fontSize, showText]);

  return (
    <div className="inline-flex flex-col items-center bg-white p-2 border rounded text-black">
      {productName && (
        <span className="text-xs font-semibold text-center mb-1 max-w-[160px] truncate">{productName}</span>
      )}
      <svg ref={svgRef} />
      {price && (
        <span className="text-sm font-bold mt-1">{price}</span>
      )}
    </div>
  );
}
