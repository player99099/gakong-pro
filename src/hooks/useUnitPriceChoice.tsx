import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { UnitPriceChoiceModal } from '../components/orders/UnitPriceChoiceModal';

export function useUnitPriceChoice() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({
    orderPrice: 0,
    bomPrice: 0,
    drawingNo: '',
    referenceSource: 'bom' as 'bom' | 'item',
  });
  const resolverRef = useRef<((value: number | null) => void) | null>(null);

  const prompt = useCallback(
    (
      orderPrice: number,
      bomPrice: number,
      drawingNo = '',
      referenceSource: 'bom' | 'item' = 'bom',
    ) =>
      new Promise<number | null>((resolve) => {
        resolverRef.current = resolve;
        flushSync(() => {
          setData({ orderPrice, bomPrice, drawingNo, referenceSource });
          setOpen(true);
        });
      }),
    [],
  );

  const close = (value: number | null) => {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  };

  const modal = (
    <UnitPriceChoiceModal
      open={open}
      drawingNo={data.drawingNo}
      orderPrice={data.orderPrice}
      bomPrice={data.bomPrice}
      referenceSource={data.referenceSource}
      onSelectOrder={() => close(data.orderPrice)}
      onSelectBom={() => close(data.bomPrice)}
      onCancel={() => close(null)}
    />
  );

  return { prompt, modal };
}
