import { createContext, useState, useEffect, useCallback } from "react";
import { baseUrl, getRequest, postRequest } from "../utils/services";
import {io} from "socket.io-client";

export const ChatContext = createContext();

export const ChatContextProvider = ({ children, user }) => {
  const [userChats, setUserChats] = useState(null);
  const [isUserChatsLoading, setIsUserChatsLoading] = useState(false);
  const [userChatsError, setUserChatsError] = useState(null);

  const [potentialChats, setPotentialChats] = useState([]);
  const [isPotentialChatsLoading, setIsPotentialChatsLoading] = useState(false);
  const [potentialChatsError, setPotentialChatsError] = useState(null);

  const [currentChat, setCurrentChat] = useState(null);

  const [messages, setMessages] = useState(null);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [sendTextMessageError, setSendTextMessageError] = useState(null);
  const [newMessage, setNewMessage] = useState(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  console.log("notifications", notifications);

  useEffect(() => {
    const newSocket = io("http://localhost:3000");
    setSocket(newSocket);

    return () =>{
      newSocket.disconnect()
    }
}, [user]);

  useEffect(() => {
    if (socket == null) return;
    socket.emit("addNewUser", user?._id);
    socket.on("getOnlineUsers", (res) => {
      setOnlineUsers(res);
    });

    return() => {
      socket.off("getOnlineUsers");
    }
  }, [socket]);

  //send message
  useEffect(() => {
    if (socket === null) return;

    const recipientId = currentChat?.members?.find((id) => id !== user?._id);

    socket.emit("sendMessage", {...newMessage, recipientId});
  }, [newMessage]);

  //receive message and notification
  useEffect(() => {
    if (socket === null) return;
     
    socket.on("getMessage", (res) => {
      if (currentChat?._id !== res.chatId) return;

      setMessages((prev) => [...prev, res]);
    });

    socket.on("getNotification", (res) => {
      const isChatOpen = currentChat?.members.some(id => id === res.senderId)

      if(isChatOpen){
        setNotifications(prev => [{...res, isRead:true}, ...prev])
      }else {
        setNotifications(prev => [res, ...prev])
      }
    })

    return () =>{
      socket.off("getMessage");
      socket.off("getNotification");
    }
  }, [socket, currentChat]);


  useEffect(() => {
    const getUserChats = async () => {
      if (user?._id) {
        setIsUserChatsLoading(true);
        setUserChatsError(null);

        const response = await getRequest(`${baseUrl}/chats/${user._id}`);
        setIsUserChatsLoading(false);

        if (response.error) {
          setUserChatsError(response);
        } else {
          setUserChats(response);
        }
      }
    };

    getUserChats();
  }, [user, notifications]);

  // Fetch potential chats (users not yet chatted with)
  useEffect(() => {
    const getUsers = async () => {
      if (!user || !userChats) return;

      setIsPotentialChatsLoading(true);
      setPotentialChatsError(null);

      const response = await getRequest(`${baseUrl}/users`);
      setIsPotentialChatsLoading(false);

      if (response.error) {
        setPotentialChatsError(response);
        return;
      }

      const pChats = response.filter((u) => {
        if (user._id === u._id) return false;

        const isChatCreated = userChats.some((chat) =>
          chat.members.includes(u._id)
        );

        return !isChatCreated;
      });

      setPotentialChats(pChats);
      setAllUsers(response);
    };

    getUsers();
  }, [user, userChats]);

  // Fetch messages for current chat
  useEffect(() => {
    if (!currentChat?._id) return;

    const getMessages = async () => {
      setIsMessagesLoading(true);
      setMessagesError(null);

      const response = await getRequest(`${baseUrl}/messages/${currentChat._id}`);
      setIsMessagesLoading(false);

      if (response.error) {
        setMessagesError(response);
      } else {
        setMessages(response);
      }
    };

    getMessages();
  }, [currentChat]);

  const sendTextMessage = useCallback(
    async(textMessage, sender, currentChatId, setTextMessage)=>{
    if(!textMessage) return console.log("You must type something...");

      const response = await postRequest(
        `${baseUrl}/messages`,
        JSON.stringify({
        chatId: currentChatId,
        senderId: sender._id,
        text: textMessage
      })
    );
    if (response.error) {
      return setSendTextMessageError(response);
    }

    setNewMessage(response)
    setMessages((prev)=> [...prev, response])
    setTextMessage("")


  },
  []
);

  // Update current chat
  const updateCurrentChat = useCallback((chat) => {
    setCurrentChat(chat);
  }, []);

  // Create new chat
  const createChat = useCallback(async (firstId, secondId) => {
    const response = await postRequest(
      `${baseUrl}/chats`,
      JSON.stringify({ firstId, secondId })
    );

    if (response.error) {
      console.log("Error creating chat", response);
      return;
    }

    setUserChats((prev) => [...(prev || []), response]);
  }, []);

  const markAllNotificationsAsRead = useCallback((notifications) => {
    const mNotifications = notifications.map((n) => {
       return {...n, isRead:true}
      });

      setNotifications(mNotifications);
  }, []);

  const markNotificationsAsRead = useCallback(
    (n, userChats, user, notifications) => {
    // find chat to open 
    
    const desiredChat = userChats.find((chat) => {
      const chatMembers = [user._id ,n.senderId];
      const isDesiredChat = chat?.members.every((member) => {
        return chatMembers.includes(member);
      });

      return isDesiredChat;
    });

    // mark notification as read
    const mNotifications = notifications.map(el =>{
      if(n.senderId === el.senderId){
        return {...n, isRead:true};
      } else {
        return el;
      }
    })

    updateCurrentChat(desiredChat);
    setNotifications(mNotifications);    
  }, 
  []
  );

  const markThisUserNotificationsAsRead = useCallback((thisUserNotifications, notifications) => {
    // mark notification as read

    const mNotifications = notifications.map(el =>{
      let notification;

      thisUserNotifications.forEach(n =>{
        if(n.senderId === el.senderId){
          notification = {...n, isRead:true};
        }else {
          notification = el;
        }
      });

      return notification;
    });

    setNotifications(mNotifications);
  }, 
  []
);

  return (
    <ChatContext.Provider
      value={{
        userChats,
        isUserChatsLoading,
        userChatsError,
        potentialChats,
        isPotentialChatsLoading,
        potentialChatsError,
        createChat,
        updateCurrentChat,
        currentChat,
        messages,
        isMessagesLoading,
        messagesError,
        sendTextMessage,
        onlineUsers,
        notifications,
        allUsers,
        markAllNotificationsAsRead,
        markNotificationsAsRead,
        markThisUserNotificationsAsRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
