import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = "items",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (safeCurrentPage >= totalPages - 3) {
        pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      className="fleet-pagination"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 16px",
        background: "#ffffff",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        marginTop: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        fontSize: "13px",
      }}
    >
      {/* Left side: Showing count & page size */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
          Showing <b style={{ color: "#1a202c" }}>{startItem}</b> to <b style={{ color: "#1a202c" }}>{endItem}</b> of{" "}
          <b style={{ color: "var(--primary-dark)" }}>{totalItems}</b> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "#f8fafc",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "#2d3748",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Page navigation buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          aria-label="First page"
          style={navButtonStyle(safeCurrentPage === 1)}
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Prev Page */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          aria-label="Previous page"
          style={navButtonStyle(safeCurrentPage === 1)}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Numeric Pages */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: "0 6px",
                    color: "var(--text-muted)",
                    userSelect: "none",
                    fontWeight: 700,
                  }}
                >
                  …
                </span>
              );
            }
            const isSelected = p === safeCurrentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                style={{
                  minWidth: "32px",
                  height: "32px",
                  padding: "0 6px",
                  borderRadius: "8px",
                  border: isSelected ? "none" : "1px solid var(--border)",
                  background: isSelected ? "var(--primary)" : "#ffffff",
                  color: isSelected ? "#ffffff" : "#2d3748",
                  fontWeight: isSelected ? 700 : 600,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
          aria-label="Next page"
          style={navButtonStyle(safeCurrentPage === totalPages)}
        >
          <ChevronRight size={16} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage === totalPages}
          aria-label="Last page"
          style={navButtonStyle(safeCurrentPage === totalPages)}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}

function navButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: disabled ? "#f8fafc" : "#ffffff",
    color: disabled ? "#a0aec0" : "#2d3748",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all 0.15s ease",
  };
}
