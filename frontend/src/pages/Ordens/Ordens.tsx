import Pagination from "../../components/Pagination/Pagination";
import trpc from "../../api";
import { useUserContext } from "../../contexts/UserContext";
import { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { ARRAY_10 } from "../../utils/Constants";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import "./Ordens.scss";

interface IAdminFilter {
  page: number;
  total: number;
  search: string;
  active: number;
  startDate: Date | null;
  endDate: Date | null;
}

export const Ordens = () => {

  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [ordens, setOrdens] = useState<any>([]);
  const [totalOrdens, setTotalOrdens] = useState(0)
  const [loader, setLoader] = useState<boolean>(true);
  const formatDate = (dateString) => {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  }
  const [filters, setFilters] = useState<any>({
    page: 0,
    search: '',
    active: 1,
    startDate: formatDate(new Date('2010-01-01')),
    endDate: formatDate(new Date()),
  })


  const getOrdens = async () => {
    let body = {
      where: {

      }
    }
    try {
      const ordens: any = await trpc.orders.findManyOrders.query(body);
      setOrdens(ordens);
      setLoader(false);
    }
    catch (error) {
      console.log(error);
    }
  }



  const startFilter = (key: string, value: string | number) => {
    let tempFilters: any = filters;
    if (key !== 'page') {
      tempFilters.page = 0;
    }
    if (key === 'startDate' || key === 'endDate') {
      value = formatDate(value);
    }
    tempFilters[key] = value;
    filterOrdens(tempFilters);
    setFilters(tempFilters);
  }

  const filterOrdens = async (filt: IAdminFilter) => {
    setLoader(true);
    try {
      let body: any = {
        take: 10,
        skip: filt.page * 10,
        where: {
          payment_method: {
            startsWith: filt.search,
          },
          status: {
            equals: filt.active
          },
          date_order: {
            gte: filt.startDate,
            lte: filt.endDate
          }
        }
      }
      let body2: any = {
        where: {
          payment_method: {
            startsWith: filt.search,
          },
          status: {
            equals: filt.active
          },
          date_order: {
            gte: filt.startDate,
            lte: filt.endDate
          }
        },
        select: {
          id: true,
        },
      }
      const tempUsers = await trpc.orders.findManyOrders.query(body);
      const totalUsersResponse = await trpc.orders.findManyOrders.query(body2);
      setLoader(false);
      setOrdens(tempUsers);
      setTotalOrdens(totalUsersResponse.length);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      navigate('/');
    }
  }, [currentUser])
  useEffect(() => {
    getOrdens();
    filterOrdens(filters);
  }, [])

  return (
    <div className="ordens-contain">
      <div className="header">
        <h1>Ordenes</h1>
      </div>
      <div className="filter-contain">
        <div className="select-input">
        <p>Metodo de Pago</p>
          <select onChange={(e) => startFilter('search', e.target.value)}>
            <option value={''}>Todos</option>
            <option value={'Paypal'}>Paypal</option>
            <option value={'Stripe'}>Stripe</option>
            <option value={'Conekta OXXO'}>Conekta OXXO</option>
          </select>
        </div>
        <div className="select-input">
        <p>Estado</p>
          <select onChange={(e) => startFilter('active', Number(e.target.value))}>
            <option value={1}>Activo</option>
            <option value={0}>No Activo</option>
          </select>
        </div>
        <div className="select-input">
          <p>Fecha de Inicio</p>
          <input type="date" className="date-input" onChange={(e) => startFilter('startDate', e.target.value)} />
        </div>
        <div className="select-input">
        <p>Fecha de Final</p>
          <input type="date" className="date-input" onChange={(e) => startFilter('endDate', e.target.value)} />
        </div>
      </div>
      <div className="ordens-table">
        <div className="table-contain">
          <table>
            <thead>
              <tr>
                <th>
                  Metodo de Pago
                </th>
                <th>
                  Precio Total
                </th>
                <th>
                  Fecha
                </th>
                <th>
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {!loader ?
                ordens.map((orden: any, index: number) => {
                  return (
                    <tr key={"admin_ordens_" + index}>
                      <td className="">
                        {orden.payment_method}
                      </td>
                      <td>
                        {orden.total_price}
                      </td>
                      <td>
                        {orden.date_order.toLocaleDateString()}
                      </td>
                      <td>
                        {orden.status === 1 ? "Activa" : "No activa"}
                      </td>
                    </tr>

                  )
                })
                : ARRAY_10.map((val: string, index: number) => {
                  return (
                    <tr key={"array_10" + index} className="tr-load">
                      <td /><td /><td /><td /><td />
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
        <Pagination
          totalData={totalOrdens}
          title="ordenes"
          startFilter={startFilter}
          currentPage={filters.page}
        />
      </div>
    </div>
  )
}
