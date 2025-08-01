import React from 'react'
import { Button } from './ui/Button'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems?: number
  hasMore?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  loading?: boolean
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  hasMore,
  onPageChange,
  onPageSizeChange,
  loading
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems || currentPage * pageSize)

  return (
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
      {/* Top row: Page size selector and item count */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={loading}
            className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </div>
        
        <div className="text-xs text-gray-600">
          {totalItems ? (
            `${startItem}-${endItem} of ${totalItems}`
          ) : (
            `Page ${currentPage}${hasMore ? '+' : ''}`
          )}
        </div>
      </div>

      {/* Bottom row: Navigation */}
      <div className="flex items-center justify-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeftIcon className="h-4 w-4 text-gray-600" />
        </button>

        <div className="flex items-center space-x-1 px-2">
          {/* Simplified page display */}
          {totalPages > 0 ? (
            <>
              {currentPage > 1 && (
                <button
                  onClick={() => onPageChange(1)}
                  disabled={loading}
                  className="px-2 py-1 text-xs rounded hover:bg-gray-200 text-gray-600"
                >
                  1
                </button>
              )}
              
              {currentPage > 2 && <span className="text-xs text-gray-400">...</span>}
              
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium">
                {currentPage}
              </span>
              
              {(hasMore || currentPage < totalPages) && (
                <>
                  {totalPages > currentPage + 1 && <span className="text-xs text-gray-400">...</span>}
                  {totalPages > currentPage && (
                    <button
                      onClick={() => onPageChange(totalPages)}
                      disabled={loading}
                      className="px-2 py-1 text-xs rounded hover:bg-gray-200 text-gray-600"
                    >
                      {totalPages}
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <span className="px-2 py-1 text-xs text-gray-500">Page {currentPage}</span>
          )}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={(!hasMore && currentPage >= totalPages) || loading}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRightIcon className="h-4 w-4 text-gray-600" />
        </button>
      </div>
    </div>
  )
}