import { useEffect, useState } from "react";
import { useUserContext } from "../../contexts/UserContext";
import trpc from "../../api";
import { IAdminUser } from "interfaces/admin";
import './Admin.scss';
import { Spinner } from "../../components/Spinner/Spinner";

function Admin(){
    const { currentUser } = useUserContext();
    const [users, setUsers] = useState<IAdminUser[]>([]);
    const [allUsers, setAllUsers] = useState<IAdminUser[]>([]);
    const [loader, setLoader] = useState<boolean>(true);
    const getAllUsers = async () => {
        let body: any = {

        }
        try{
            const tempUsers = await trpc.users.findManyUsers.query(body);
            console.log(tempUsers);
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
    const giveSuscription = (user: IAdminUser) => {
        const confirmed = window.confirm('Seguro que quieren activar la suscripcion de este usuario?');
        if (confirmed) {
          activateSubscription(user);
        } else {

        }
    }
    const activateSubscription = async (user: IAdminUser) => {
        try{
            let body = {

            }
            // const activate = trpc.admin.activatePlanForUser.mutation(body);
        }
        catch(error){
            console.log(error);
        }
    }
    useEffect(() => {
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
        </div>
    )
}
export default Admin;