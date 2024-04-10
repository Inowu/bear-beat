import Pagination from "../../../components/Pagination/Pagination";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ARRAY_10 } from "../../../utils/Constants";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import "./Ordens.scss";
import { IAdminOrders } from "../../../interfaces/admin";
import { of } from "await-of";

interface IAdminFilter {
  active: number;
  endDate: Date | undefined;
  limit: number;
  page: number;
  paymentMethod: string;
  searchData: string;
  startDate: Date | undefined;
}

export const Ordens = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [ordens, setOrdens] = useState<IAdminOrders[]>([]);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [totalOrdens, setTotalOrdens] = useState(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [filters, setFilters] = useState<IAdminFilter>({
    active: 1,
    endDate: undefined,
    limit: 100,
    page: 0,
    paymentMethod: "",
    searchData: "",
    startDate: undefined,
  });

  const startFilter = (key: string, value: string | number) => {
    let tempFilters: any = filters;
    if (key !== "page") {
      tempFilters.page = 0;
    }
    if (key === "startDate" || key === "endDate") {
      value = value;
    }
    tempFilters[key] = value;
    setFilters(tempFilters);
    filterOrdens(tempFilters);
  };
  const filterOrdens = async (filt: IAdminFilter) => {
    setLoader(true);
    setTotalLoader(true);

    let body: any = {
      take: filt.limit,
      skip: filt.page * filt.limit,
      email: filt.searchData,
      paymentMethod: filt.paymentMethod,
    };

    if (filt.startDate && filt.endDate) {
      body = {
        ...body,
        date_order: {
          gte: filt.startDate,
          lte: filt.endDate
        }
      }
    }

    const [tempOrders, errorOrders] = await of(trpc.orders.findManyOrdersWithUsers.query(body));

    console.log(tempOrders!.data)
    if (errorOrders && !tempOrders) {
      throw new Error(errorOrders.message);
    }

    setOrdens(tempOrders!.data);
    setTotalOrdens(tempOrders!.count);
    setLoader(false);
    setTotalLoader(false);
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
        <div className="search-input">
          <input
            placeholder="Buscar por email o teléfono"
            onChange={(e: any) => {
              startFilter("searchData", e.target.value);
            }}
          />
          <FontAwesomeIcon icon={faSearch} />
        </div>
      </div>
      <div className="filter-contain">
        <div className="select-input">
          <p>Metodo de Pago</p>
          <select onChange={(e) => startFilter("paymentMethod", e.target.value)}>
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
                ? ordens.map((orden: IAdminOrders, index: number) => {
                  return (
                    <tr key={"admin_ordens_" + index}>
                      <td className="">{orden.email}</td>
                      <td className="">{orden.phone}</td>
                      <td className="">
                        {orden.payment_method
                          ? orden.payment_method
                          : "Sin PM"}
                      </td>
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
