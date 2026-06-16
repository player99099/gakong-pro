import { useCallback } from 'react';
import type { PrintContext, PrintLayout } from '../../types/printTemplate';
import { PrintCanvas } from './PrintCanvas';
import { PrintDuplexPreview } from './PrintDuplexPreview';
import { Modal } from '../ui/Modal';

export const PRINT_GUIDE_DUPLEX =
  '인쇄 대화상자에서 「양면 인쇄」를 선택하세요.\n1면: 세로(수검표) / 2면: 가로(공정흐름)';

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  layout: PrintLayout;
  context: PrintContext;
  loading?: boolean;
  onPrinted?: () => void;
}

export function PrintPreviewModal({
  open,
  onClose,
  title,
  layout,
  context,
  loading = false,
  onPrinted,
}: PrintPreviewModalProps) {
  const handlePrint = useCallback(() => {
    window.print();
    onPrinted?.();
  }, [onPrinted]);

  return (
    <Modal
      title={title}
      open={open}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="text-muted" style={{ marginRight: 'auto', fontSize: 12 }}>
            {PRINT_GUIDE_DUPLEX.replace('\n', ' · ')}
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={loading}
          >
            인쇄
          </button>
        </>
      }
    >
      {loading ? (
        <div className="loading-spinner">출력 데이터 준비 중...</div>
      ) : (
        <>
          <PrintDuplexPreview layout={layout} context={context} maxWidthPx={680} />
          <div className="print-only-root" aria-hidden="true">
            <PrintCanvas layout={layout} context={context} className="print-only-canvas" />
          </div>
        </>
      )}
    </Modal>
  );
}
