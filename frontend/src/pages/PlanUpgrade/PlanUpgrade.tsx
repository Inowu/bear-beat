import React, { useEffect, useState } from 'react'
import './PlanUpgrade'
import trpc from "../../api";
import { IPlans } from 'interfaces/Plans';
import { Spinner } from '../../components/Spinner/Spinner';
import PlanCard from '../../components/PlanCard/PlanCard';
import { useNavigate } from 'react-router-dom';

export const PlanUpgrade = () => {
    const [plans, setPlans] = useState<IPlans[]>([]);
    const [loader, setLoader] = useState<boolean>(true);
    const navigate = useNavigate();
    const getPlans = async () => {
      let body = {
        where: {
          activated: 1,
          paypal_plan_id: null,
        }
      }
      try {
        const plans: any = await trpc.plans.findManyPlans.query(body);
        setPlans(plans);
        setLoader(false);
      }
      catch (error) {
        console.log(error);
      }
    }
    const getCurrentPlan = async () => {
      try{
        const currentPlan = await trpc.auth.getCurrentSubscriptionPlan.query();
        console.log(currentPlan);
      }
      catch(error){
        // navigate('/planes')
        console.log(error)
      }
    }
    useEffect(() => {
        getCurrentPlan();
        getPlans();
      }, [])
      if (loader) {
        return (
          <div className="global-loader" style={{ height: "60vh", display: "flex", justifyContent: "center" }}>
            <Spinner size={5} width={.5} color="#00e2f7" />
          </div>
        )
      }
  return (
    <div className='plans-main-container'>
      {plans.length> 0 &&
        <PlanCard currentPlan={true} plan={plans[0]}/>
      }
        {plans.map((plan: IPlans, index) => {
        return <PlanCard plan={plan} key={"plan_" + index} />;
      })}
    </div>
  )
}
