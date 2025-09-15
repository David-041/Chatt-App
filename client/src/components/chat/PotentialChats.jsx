import { useContext } from "react";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";

const PotentialChats = () => {
    const {user} = useContext(AuthContext);
    const {potentialChats, createChat, OnlineUsers} = useContext(ChatContext);

    return (
    <>
    <div className=".all-users">
        {PotentialChats && 
        potentialChats.map((u, index)=> {
            return (
                 <div className="single-user"
                 key = {index}
                 onClick={()=> createChat(user._id, u._id)}
                 >
                {u.name}
                 <span className={
                    OnlineUsers?.some((user) => user?.userId === u._id) 
                    ? "user-online" 
                    : ""
                    }
                    ></span>
            </div>  
            );
         })}
    </div>
    </>
    );
};
 
export default PotentialChats;