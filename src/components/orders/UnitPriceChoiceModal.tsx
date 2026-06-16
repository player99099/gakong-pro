import { Modal } from '../ui/Modal';
import { formatNumber } from '../../lib/formatNumber';
import { getUnitPriceDiffSummary } from '../../lib/orderUnitPrice';

export function UnitPriceChoiceModal({
  open,
  drawingNo,
  orderPrice,
  bomPrice,
  referenceSource = 'bom',
  onSelectOrder,
  onSelectBom,
  onCancel,
}: {
  open: boolean;
  drawingNo?: string;
  orderPrice: number;
  bomPrice: number;
  referenceSource?: 'bom' | 'item';
  onSelectOrder: () => void;
  onSelectBom: () => void;
  onCancel: () => void;
}) {
  const referenceLabel =
    referenceSource === 'bom' ? 'BOM 등록 단가' : '품목 등록 단가';
  const diffSummary = getUnitPriceDiffSummary(orderPrice, bomPrice);

  return (
    <Modal
      title="단가 불일치 — 적용 단가 선택"
      open={open}
      onClose={onCancel}
      stackLayer="top"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            취소 (저장 중단)
          </button>
          <button type="button" className="btn btn-secondary" onClick={onSelectBom}>
            {referenceLabel} 적용 ({formatNumber(bomPrice)})
          </button>
          <button type="button" className="btn btn-primary" onClick={onSelectOrder}>
            수주(매출) 단가 적용 (
            {orderPrice > 0 ? formatNumber(orderPrice) : '미입력 · 0'})
          </button>
        </>
      }
    >
      {drawingNo && (
        <p className="unit-price-choice-drawing">
          도번: <strong>{drawingNo}</strong>
        </p>
      )}

      <div
        className={`unit-price-choice-diff unit-price-choice-diff--${diffSummary.direction}`}
        role="status"
      >
        <div className="unit-price-choice-diff-title">단가 차이 발생</div>
        <div className="unit-price-choice-diff-row">
          <span className="unit-price-choice-diff-label">BOM 등록 단가</span>
          <span className="unit-price-choice-diff-value">{formatNumber(bomPrice)}원</span>
        </div>
        <div className="unit-price-choice-diff-row">
          <span className="unit-price-choice-diff-label">수주(매출) 단가</span>
          <span className="unit-price-choice-diff-value">
            {orderPrice > 0 ? `${formatNumber(orderPrice)}원` : '미입력 (0원)'}
          </span>
        </div>
        <div className="unit-price-choice-diff-row unit-price-choice-diff-row--highlight">
          <span className="unit-price-choice-diff-label">차이</span>
          <span className="unit-price-choice-diff-value">{diffSummary.diffText}</span>
        </div>
        {diffSummary.percentText && (
          <p className="unit-price-choice-diff-note">{diffSummary.percentText}</p>
        )}
      </div>

      <p className="unit-price-choice-lead">
        수주(매출) 단가와 {referenceLabel}가 <strong>서로 다릅니다</strong>.
        <br />
        이번 수주에 적용할 단가를 선택해 주세요.
      </p>

      <div className="unit-price-choice-grid">
        <button
          type="button"
          className="unit-price-choice-card"
          onClick={onSelectOrder}
        >
          <span className="unit-price-choice-label">수주(매출) 단가</span>
          <span className="unit-price-choice-value">
            {orderPrice > 0 ? formatNumber(orderPrice) : '미입력 (0)'}
          </span>
          <span className="unit-price-choice-desc">엑셀·폼에 입력된 매출 단가</span>
        </button>
        <button
          type="button"
          className="unit-price-choice-card unit-price-choice-card--bom"
          onClick={onSelectBom}
        >
          <span className="unit-price-choice-label">{referenceLabel}</span>
          <span className="unit-price-choice-value">{formatNumber(bomPrice)}</span>
          <span className="unit-price-choice-desc">
            품목/BOM 관리에 등록된 기준 단가 (수주로 변경 불가)
          </span>
        </button>
      </div>

      <div className="alert alert-error unit-price-choice-notice">
        <span className="alert-icon">!</span>
        <span className="alert-text">
          <strong>선택하신 단가는 이번 수주 건에만 적용</strong>됩니다. 수주 저장으로
          BOM 단가가 바뀌지 않습니다.
          <br />
          <br />
          <strong>원칙: BOM 단가 변경은 반드시 품목/BOM 관리에서 직접</strong>{' '}
          수정해야 합니다. BOM 기준 단가를 바꾸려면 해당 메뉴에서 도번 단가를
          맞춘 뒤, 이후 수주 등록 시 단가가 일치하면 이 안내는 표시되지 않습니다.
        </span>
      </div>
    </Modal>
  );
}
