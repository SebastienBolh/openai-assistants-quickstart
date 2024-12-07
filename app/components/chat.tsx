"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import Markdown from "react-markdown";

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
};

const UserMessage = ({ text }: { text: string }) => {
  return <div className={styles.userMessage}>{text}</div>;
};

const AssistantMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.assistantMessage}>
      <Markdown>{text}</Markdown>
    </div>
  );
};

const CodeMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.codeMessage}>
      {text.split("\n").map((line, index) => (
        <div key={index}>
          <span>{`${index + 1}. `}</span>
          {line}
        </div>
      ))}
    </div>
  );
};

const Message = ({ role, text }: MessageProps) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} />;
    case "assistant":
      return <AssistantMessage text={text} />;
    case "code":
      return <CodeMessage text={text} />;
    default:
      return null;
  }
};

const Chat = () => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [threadId, setThreadId] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // create a new threadID when chat component created
  useEffect(() => {
    const createThread = async () => {
      const res = await fetch(
        "https://your-lambda-endpoint.amazonaws.com/dev",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = await res.json();
      setThreadId(data.threadId);
    };

    createThread();
  }, []);

  const sendMessage = async (text, tempId) => {
    setInputDisabled(true);
    setIsThinking(true);

    // add the user message to the thread
    const addMessageResponse = await fetch(
      `LAMBDA_FUNCTION_URL/threads/${threadId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "user",
          content: text,
        }),
      }
    );

    if (!addMessageResponse.ok) {
      const errorData = await addMessageResponse.text();
      console.error("Failed to add message:", errorData);
      setInputDisabled(false);
      setIsThinking(false);
      return;
    }

    const messageData = await addMessageResponse.json();

    // Replace the temporary ID with the server-generated ID
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === tempId ? { ...msg, id: messageData.id } : msg
      )
    );

    // Update messages state with user's message
    setMessages((prevMessages) => {
      const existingIds = new Set(prevMessages.map((msg) => msg.id));
      const newMessage = { role: "user", text, id: messageData.id };

      return existingIds.has(newMessage.id)
        ? prevMessages
        : [...prevMessages, newMessage];
    });

    // Add the "thinking" bubble
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "assistant", text: "...", id: "thinking" },
    ]);

    const runResponse = await fetch(
      `${LAMBDA_FUNCTION_URL}/threads/${threadId}/runs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instructions: "", // Add any instructions if needed
        }),
      }
    );

    console.log("RUN RESPONSE", runResponse);

    if (!runResponse.ok) {
      const errorData = await runResponse.text();
      console.error("Run creation failed:", errorData);
      setInputDisabled(false);
      setIsThinking(false);
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== "thinking")
      );
      return;
    }

    const runData = await runResponse.json();
    const runId = runData.runId;

    // Poll for the run's status
    await pollRunStatus(runId);
  };

  const pollRunStatus = async (runId) => {
    let runStatus = "running";
    while (
      ["running", "requires_action", "waiting", "in_progress"].includes(
        runStatus
      )
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      const statusResponse = await fetch(
        `/api/assistants/threads/${threadId}/runs/${runId}`
      );

      if (!statusResponse.ok) {
        const errorData = await statusResponse.text();
        console.error("Failed to fetch run status:", errorData);
        setInputDisabled(false);
        setIsThinking(false);
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== "thinking")
        );
        return;
      }

      const statusData = await statusResponse.json();
      runStatus = statusData.status;
      console.log(`Run status: ${runStatus}`);

      if (runStatus === "requires_action") {
        // Handle required actions (e.g., function calls)
        // ...
      }
    }

    // When the run is completed, fetch the assistant messages
    if (runStatus === "completed") {
      const getMessagesResponse = await fetch(
        `LAMBDA_FUNCTION_URL/threads/${threadId}/messages`,
        {
          method: "GET",
        }
      );

      if (!getMessagesResponse.ok) {
        const errorData = await getMessagesResponse.text();
        console.error("Failed to fetch messages:", errorData);
        setInputDisabled(false);
        setIsThinking(false);
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== "thinking")
        );
        return;
      }

      const messagesData = await getMessagesResponse.json();

      // Update messages state with assistant messages
      // Filter out messages already in state
      const existingMessageIds = new Set(messages.map((msg) => msg.id));
      const newMessages = messagesData.filter(
        (msg) => !existingMessageIds.has(msg.id) && msg.role === "assistant"
      );

      if (newMessages.length > 0) {
        const latestMessage = newMessages[newMessages.length - 1];

        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === "thinking"
              ? {
                  role: "assistant",
                  text: latestMessage.content[0]?.text?.value || "",
                  id: latestMessage.id,
                }
              : msg
          )
        );
      }

      setInputDisabled(false);
      setIsThinking(false);
    } else {
      // Handle other statuses if necessary
      setInputDisabled(false);
      setIsThinking(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const tempId = `temp-${Date.now()}`; // Temporary ID

    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: userInput, id: tempId },
    ]);

    sendMessage(userInput, tempId);
    setUserInput("");
    scrollToBottom();
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messages}>
        {messages.map((msg, index) => (
          <Message key={index} role={msg.role} text={msg.text} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className={`${styles.inputForm} ${styles.clearfix}`}
      >
        <input
          type="text"
          className={styles.input}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Enter your question"
        />
        <button
          type="submit"
          className={styles.button}
          disabled={inputDisabled}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
