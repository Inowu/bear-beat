import React from "react";
import "./Pagination.scss";
import { ChevronLeft, ChevronRight } from "src/icons";
import { showPages } from "./PaginationMethods";
import { Spinner } from "../../components/Spinner/Spinner";
import { Button } from "src/components/ui";
interface IPagination {
  totalData: number;
  title: string;
  startFilter: (key: string, value: string | number) => void;
  currentPage: number;
  limit: number;
  totalLoader?: boolean;
}
function Pagination(props: IPagination) {
  const { title, totalData, startFilter, currentPage, limit, totalLoader } =
    props;
  const totalPages = Math.max(1, Math.ceil(totalData / limit));
  const canGoBack = currentPage > 0;
  const canGoForward = currentPage + 1 < totalPages;
  const changePage = (direction: string, page: number) => {
    if (direction === "back" && currentPage !== 0) {
      startFilter("page", page);
    }
    if (direction === "direct") {
      startFilter("page", page);
    }
    if (
      direction === "forward" &&
      currentPage + 1 < totalPages
    ) {
      startFilter("page", page);
    }
  };
  return (
    <div className="pagination-container">
      <div className="left-side">
        <div className="total">
          <p className="left-text">Total de {title}:</p>
          {totalLoader ? (
            <Spinner size={1} width={0.1} color="var(--app-accent)" />
          ) : (
            <p className="left-text">{totalData}</p>
          )}
        </div>
        <p className="left-text">Datos por página: {limit}</p>
      </div>
      <div className="right-side">
        <Button unstyled
          type="button"
          className="page-nav"
          aria-label="Página anterior"
          onClick={() => changePage("back", currentPage - 1)}
          disabled={!canGoBack}
        >
          <ChevronLeft aria-hidden />
        </Button>
        {showPages(currentPage + 1, totalData, limit).map(
          (val: number | string, index: number) => {
            if (typeof val !== "number") {
              return (
                <span key={"paginate_" + index} className="points" aria-hidden>
                  {val}
                </span>
              );
            }

            const isCurrent = currentPage + 1 === val;
            return (
              <Button unstyled
                key={"paginate_" + index}
                type="button"
                className={isCurrent ? "selected" : "unselected"}
                aria-label={`Ir a página ${val}`}
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => (isCurrent ? null : changePage("direct", val - 1))}
                disabled={isCurrent}
              >
                {val}
              </Button>
            );
          }
        )}
        <Button unstyled
          type="button"
          className="page-nav"
          aria-label="Página siguiente"
          onClick={() => changePage("forward", currentPage + 1)}
          disabled={!canGoForward}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
export default Pagination;
