import Pagination from "../../../components/Pagination/Pagination";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ARRAY_10 } from "../../../utils/Constants";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import "./Ordens.scss";

interface IAdminFilter {
  page: number;
  limit: number;
  total: number;
  search: string;
  searchData: string;
  active: number;
  startDate: Date;
  endDate: Date;
}

export const Ordens = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [ordens, setOrdens] = useState<any>([]);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [totalOrdens, setTotalOrdens] = useState(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [filters, setFilters] = useState<any>({
    page: 0,
    search: "",
    searchData: "",
    active: 1,
    limit: 100,
    startDate: new Date("2010-01-01"),
    endDate: new Date(),
  });

  const startFilter = (key: string, value: string | number) => {
    let tempFilters: any = filters;
    if (key !== "page") {
      tempFilters.page = 0;
    }
    if (key === "startDate" || key === "endDate") {
      console.log(value);
      value = value;
    }
    tempFilters[key] = value;
    filterOrdens(tempFilters);
    setFilters(tempFilters);
  };
  const filterOrdens = async (filt: IAdminFilter) => {
    setLoader(true);
    setTotalLoader(true);
    try {
      let body = {
        take: filt.limit,
        skip: filt.page * filt.limit,
        where: {
          payment_method: {
            startsWith: filt.search,
          },
          // email: {
          //   startsWith: filt.searchData,
          // },
          status: {
            equals: filt.active,
          },
          date_order: {
            gte: filt.startDate,
            lte: filt.endDate,
          },
        },
        orderBy: {
          date_order: "desc",
        },
      };
      let body2: any = {
        where: {
          payment_method: {
            startsWith: filt.search,
          },
          // email: {
          //   startsWith: filt.searchData,
          // },
          status: {
            equals: filt.active,
          },
          date_order: {
            gte: filt.startDate,
            lte: filt.endDate,
          },
        },
        include: {
          id: true,
        },
      };
      const tempOrders: any =
        await trpc.orders.findManyOrdersWithUsers.query(body);
      setLoader(false);
      setOrdens(tempOrders);
      const totalOrders =
        await trpc.orders.findManyOrdersWithUsers.query(body2);
      setTotalOrdens(totalOrders.length);
      setTotalLoader(false);
    } catch (error: any) {
      console.log(error.message);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      navigate("/");
    }
  }, [currentUser]);
  useEffect(() => {
    filterOrdens(filters);
  }, []);

  return (
    <div className="ordens-contain">
      <div className="header">
        <h1>Ordenes</h1>
        {/* <div className="search-input">
          <input
            placeholder="Buscar por email"
            onChange={(e: any) => {
              startFilter("searchData", e.target.value);
            }}
          />
          <FontAwesomeIcon icon={faSearch} />
        </div> */}
      </div>
      <div className="filter-contain">
        <div className="select-input">
          <p>Metodo de Pago</p>
          <select onChange={(e) => startFilter("search", e.target.value)}>
            <option value={""}>Todos</option>
            <option value={"Paypal"}>Paypal</option>
            <option value={"Stripe"}>Stripe</option>
            <option value={"Conekta OXXO"}>Conekta OXXO</option>
          </select>
        </div>
        <div className="select-input">
          <p>Cantidad de ordenes</p>
          <select
            defaultValue={filters.limit}
            onChange={(e) => startFilter("limit", +e.target.value)}
          >
            <option value={""} disabled>
              Numero de datos
            </option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
        {/* <div className="select-input">
          <p>Estado</p>
          <select onChange={(e) => startFilter('active', Number(e.target.value))}>
            <option value={1}>Activo</option>
            <option value={3}>No Activo</option>
          </select>
        </div> */}
        <div className="select-input">
          <p>Fecha de Inicio</p>
          <input
            type="date"
            className="date-input"
            onChange={(e) => startFilter("startDate", e.target.value)}
          />
        </div>
        <div className="select-input">
          <p>Fecha de Final</p>
          <input
            type="date"
            className="date-input"
            onChange={(e) => startFilter("endDate", e.target.value)}
          />
        </div>
      </div>
      <div className="admin-table">
        <div className="table-contain">
          <table>
            <thead>
              <tr>
                <th>Correo</th>
                <th>Telefono</th>
                <th>Metodo de Pago</th>
                <th>Id de la suscripción</th>
                <th>Precio Total</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {!loader
                ? ordens.map((orden: any, index: number) => {
                    return (
                      <tr key={"admin_ordens_" + index}>
                        <td className="">{orden.user?.email}</td>
                        <td className="">{orden.user?.phone}</td>
                        <td className="">{orden.payment_method}</td>
                        <td>{orden.txn_id}</td>
                        <td>{orden.total_price}</td>
                        <td>{orden.date_order.toLocaleDateString()}</td>
                        <td>{orden.status === 1 ? "Activa" : "No activa"}</td>
                      </tr>
                    );
                  })
                : ARRAY_10.map((val: string, index: number) => {
                    return (
                      <tr key={"array_10" + index} className="tr-load">
                        <td />
                        <td />
                        <td />
                        <td />
                        <td />
                        <td />
                        <td />
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        <Pagination
          totalLoader={totalLoader}
          totalData={totalOrdens}
          title="ordenes"
          startFilter={startFilter}
          currentPage={filters.page}
          limit={filters.limit}
        />
      </div>
    </div>
  );
};
