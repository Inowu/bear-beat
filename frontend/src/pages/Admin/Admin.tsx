import { useEffect, useState } from "react";
import { useUserContext } from "../../contexts/UserContext";
import trpc from "../../api";
import { IAdminUser } from "../../interfaces/admin";
import './Admin.scss';
import { Spinner } from "../../components/Spinner/Spinner";
import { IPlans } from "../../interfaces/Plans";
import { OptionModal } from "../../components/Modals/OptionModal/OptionModal";

function Admin(){
    const { currentUser } = useUserContext();
    const [users, setUsers] = useState<IAdminUser[]>([]);
    const [allUsers, setAllUsers] = useState<IAdminUser[]>([]);
    const [showOption, setShowOption] = useState<boolean>(false);
    const [optionMessage, setOptionMessage] = useState<string>('');
    const [optionTitle, setOptionTitle] = useState<string>('');
    const [plans, setPlans] = useState<IPlans[]>([]);
    const [selectUser, setSelectUser] = useState({} as IAdminUser);
    const [loader, setLoader] = useState<boolean>(true);
    const openOption = () => {
        setShowOption(true);
    }
    const closeOption = () => {
        setShowOption(false);
    }
    const plan_1 = () => {
        closeOption();
        activateSubscription(plans[0])
    }
    const plan_2 = () => {
        closeOption();
        activateSubscription(plans[1])
    }
    const getAllUsers = async () => {
        let body: any = {

        }
        try{
            const tempUsers = await trpc.users.findManyUsers.query(body);
            setLoader(false);
            setUsers(tempUsers);
            setAllUsers(tempUsers);
        }catch(error){
            console.log(error);
        }
    }
    const search = (value: string) => {
        const tempUsers = [...allUsers];
        let newUsers = tempUsers.filter((user) => user.username.toLowerCase().includes(value.toLowerCase()));
        setUsers(newUsers);
    }
  const getPlans = async () => {
    let body = {
      where: {
        activated: 1,
      }
    }
    try{
      const plans: any = await trpc.plans.findManyPlans.query(body);
      console.log(plans);
      setPlans(plans);
    }
    catch(error){
      console.log(error);
    }
  }
    const giveSuscription = (user: IAdminUser) => {
        setSelectUser(user);
        setOptionTitle('Seleccione el plan');
        openOption();
    }
    const activateSubscription = async (plan: IPlans) => {
        try{
            let body = {
                planId: plan.id,
                userId: selectUser.id
            }
            console.log(body);
            // const activate = trpc.admin.activatePlanForUser.mutate(body);
        }
        catch(error){
            console.log(error);
        }
    }
    useEffect(() => {
        getPlans();
        getAllUsers();
    }, [])
    
    return(
        <div className="admin-contain">
            <div className="header">
                <h1>Admin</h1>
                <input
                    className="input"
                    placeholder="Buscar Usuario"
                    onChange={(e)=> {search(e.target.value)}}
                />
            </div>
            <div className="users-contain">
            {
                !loader ?
                users.map((user: IAdminUser, index: number)=>{
                    return(
                        <div key={"admin_users_" + index} className="user-contain">
                            <p className="name">{user.username}</p>
                            <button onClick={()=>{giveSuscription(user)}} className="btn-active">Activar Suscripcion</button>
                        </div>
                    )
                })
                : <Spinner size={3} width={.3} color="black"/>
            }
            </div>
            <OptionModal
                show={showOption}
                onHide={closeOption}
                title ={optionTitle}
                message ={optionMessage}
                action ={plan_1}
                action2 = {plan_2}
            />
        </div>
    )
}
export default Admin;