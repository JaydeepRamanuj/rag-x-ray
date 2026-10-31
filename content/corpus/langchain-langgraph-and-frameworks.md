# LangChain, LangGraph and Other LLM Frameworks: What They Do Under the Hood

An LLM application is mostly glue: format a prompt, call a model API, parse the output, call a tool, search a vector store, keep track of the conversation, retry on errors, and log what happened. **LLM frameworks** package that glue. This document explains what the main ones do, how they work underneath, and when hand-written code is the better choice.

A useful mental model: every framework below is a wrapper around the same few HTTP calls (chat completion, embedding, maybe rerank) plus a way of chaining steps. If you understand the raw calls, you understand what the framework is doing for you, and what it is hiding.

## LangChain

**LangChain** was released as an open-source Python library by Harrison Chase in **October 2022**, a month before ChatGPT, and grew into a company and a JavaScript/TypeScript port (LangChain.js). It became the default way to build early LLM apps because it offered ready-made pieces for every step of a RAG or agent pipeline.

### Core building blocks

- **Chat models:** one interface (`invoke`, `stream`, `batch`) over many providers, such as OpenAI, Anthropic, Google, Groq and local models. Swapping providers becomes a one-line change. Provider packages are separate, for example `langchain-openai` and `langchain-anthropic`.
- **Messages:** typed objects (`SystemMessage`, `HumanMessage`, `AIMessage`, `ToolMessage`) that map to each provider's message format.
- **Prompt templates:** prompts with placeholders, such as a system message plus `{context}` and `{question}` slots, filled at run time.
- **Output parsers and structured output:** turn the model's text into JSON or a typed object. `with_structured_output(schema)` uses the provider's native JSON or tool-calling mode where available, with a Pydantic model or JSON Schema describing the result.
- **Document loaders:** hundreds of loaders for PDFs, web pages, Notion, Google Drive, databases and more, each returning `Document` objects with `page_content` and `metadata`.
- **Text splitters:** chunkers such as `RecursiveCharacterTextSplitter`, which tries separators in order (`"\n\n"`, `"\n"`, `" "`, `""`) until pieces fit the chunk size. This is the same recursive idea most RAG apps use.
- **Embeddings and vector stores:** wrappers for embedding APIs and for dozens of vector databases (pgvector, Pinecone, Chroma, Qdrant, FAISS) behind one `add_documents` / `similarity_search` interface.
- **Retrievers:** anything that takes a query and returns documents. A vector store becomes a retriever with `as_retriever()`. Variants include multi-query, ensemble (hybrid with rank fusion), parent-document and contextual-compression retrievers.
- **Tools:** Python functions with a name, description and argument schema, which a model can request through tool calling. The `@tool` decorator builds the schema from the function's signature and docstring.

### LCEL and the Runnable interface

In 2023 LangChain introduced the **LangChain Expression Language (LCEL)**. Every component implements the **Runnable** interface (`invoke`, `ainvoke`, `stream`, `batch`), and runnables compose with the pipe operator:

```python
chain = prompt | model | StrOutputParser()
answer = chain.invoke({"context": docs_text, "question": "What is HNSW?"})
```

The pipe builds a sequence in which the output of each step becomes the input of the next. Because each piece is a Runnable, the whole chain automatically supports streaming, batching, async calls and tracing. A basic RAG chain looks like this:

```python
rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | model
    | StrOutputParser()
)
```

The dictionary runs the retriever and passes the question through in parallel, then the prompt template receives both. Underneath, this is: embed the question, query the vector store, join the chunks into a string, fill the template, make one chat API call, return the text. The same five steps can be written by hand in about thirty lines.

### LangChain 1.0 and agents

**LangChain 1.0** was released in **October 2025**, alongside LangGraph 1.0. The main changes:

- A single high-level agent constructor, **`create_agent`**, which takes a model, a list of tools and a system prompt and returns an agent that loops: call the model, run any tools it requests, feed the results back, and repeat until the model answers without a tool call.
- **Middleware** hooks that run before or after model calls and tool calls, used for things like summarizing long histories, human approval of tool calls, PII redaction, and retries.
- Agents now run on the **LangGraph runtime**, so they get LangGraph's persistence and streaming.
- Older chain classes (such as `LLMChain` and `RetrievalQA`) moved to a separate `langchain-classic` package, slimming the core.

### Criticisms

LangChain is widely used and widely criticized. Common complaints from its first years were deep layers of abstraction that made debugging hard, frequent breaking changes, and prompts hidden inside library classes where you could not see or tune them. The 1.0 release aimed to address stability and simplicity. The general lesson holds for any framework: be able to see the exact prompt and the exact API request your code sends.

## LangSmith

**LangSmith** is LangChain's hosted platform for **tracing**, **evaluation** and **monitoring**. Every step of a chain or agent (each model call with its prompt, tokens and latency, each retriever call with its documents, each tool call) is recorded as a nested trace you can inspect. It also stores datasets of test questions and runs evaluators over them, including LLM-as-judge evaluators. It works with LangChain, LangGraph or plain code. Open alternatives in the same space include Langfuse, Arize Phoenix and tools based on OpenTelemetry.

## LangGraph

**LangGraph**, released by the LangChain team in **January 2024**, is a lower-level library for building **stateful, multi-step agents and workflows as graphs**. Where an LCEL chain is a straight line (A then B then C), a LangGraph graph can branch, loop back, run steps in parallel, pause for a human, and resume later.

### Core concepts

- **State:** a shared data structure, usually a `TypedDict` or Pydantic model, that every node reads and updates. For a chat agent the state is often just a list of messages.
- **Reducers:** rules for how a node's update merges into the state. By default an update overwrites a key; with the `add_messages` reducer, new messages are appended to the list instead.
- **Nodes:** ordinary functions that take the current state and return a partial update. A node might call a model, run a tool, query a database or ask a human.
- **Edges:** fixed transitions from one node to the next. `START` and `END` are special nodes marking the entry and the finish.
- **Conditional edges:** a function that looks at the state and returns the name of the next node. This is how branching and loops happen, for example "if the last message has tool calls, go to the tools node, otherwise end".
- **Compile:** `graph.compile()` checks the graph and returns a runnable application with `invoke` and `stream`.

```python
from langgraph.graph import StateGraph, START, END, MessagesState

def call_model(state: MessagesState):
    return {"messages": [model_with_tools.invoke(state["messages"])]}

def should_continue(state: MessagesState):
    last = state["messages"][-1]
    return "tools" if last.tool_calls else END

builder = StateGraph(MessagesState)
builder.add_node("agent", call_model)
builder.add_node("tools", tool_node)
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue)
builder.add_edge("tools", "agent")
graph = builder.compile()
```

This is the classic **ReAct agent loop** (reason, act, observe, repeat) drawn as a graph: agent → tools → agent → tools → ... → END.

### Persistence, memory and human-in-the-loop

LangGraph's distinctive features come from **checkpointing**. When you compile a graph with a **checkpointer** (in-memory for development, or Postgres or SQLite for production), the full state is saved after every step under a **thread ID**.

That enables:

- **Conversation memory:** call the graph again with the same thread ID and it continues from the saved state.
- **Human-in-the-loop:** a node can call `interrupt()` to pause the graph, for example before sending an email or running a database write. The state is saved; when a person approves or edits, the graph resumes from exactly that point with a `Command`.
- **Time travel:** inspect any earlier checkpoint, change the state, and replay from there, which helps with debugging.
- **Fault tolerance:** a long-running workflow that crashes resumes from the last completed step instead of starting over.

LangGraph also supports **parallel branches** (fan out to several nodes and join), **map-reduce** with the `Send` API (run one node per item in a list), **subgraphs** (a graph used as a node in another graph), and **streaming** of tokens, node updates or full state as the graph runs.

### Multi-agent patterns

Because nodes can be whole agents, LangGraph is used for **multi-agent systems**: a **supervisor** agent that routes work to specialist agents, a **network** where agents hand off to each other, or a **hierarchy** of teams. Multi-agent designs add cost and failure points, and many tasks are better served by one agent with good tools.

### When to use which

- **LangChain (create_agent):** a standard tool-calling agent quickly, with middleware for common needs.
- **LangGraph:** custom control flow, such as deterministic steps mixed with LLM decisions, loops with explicit exit conditions, approval steps, long-running jobs that must survive restarts.
- **Neither:** a single prompt and API call, or a fixed RAG pipeline, which is short and clearer in plain code.

## Other frameworks and SDKs

- **LlamaIndex** (started as "GPT Index" by Jerry Liu in November 2022): focused on the data side of RAG. It offers loaders (LlamaHub), document parsing (LlamaParse, strong on PDFs and tables), many index types (`VectorStoreIndex`, summary, tree and knowledge-graph indexes), **query engines** that combine retrieval and synthesis, and an event-driven **Workflows** system for agents.
- **Haystack** (deepset, Germany): a framework of explicit **pipelines** made of components (retrievers, rankers, generators) connected in a graph, popular for production search and RAG.
- **DSPy** (Stanford NLP, 2023): treats prompts as something to be **optimized rather than hand-written**. You declare **signatures** (inputs and outputs, such as `question -> answer`) and compose **modules** (such as `ChainOfThought`), then an **optimizer** (formerly called a teleprompter) uses a small training set and a metric to search for better instructions and few-shot examples automatically.
- **Semantic Kernel and AutoGen** (Microsoft): Semantic Kernel is an SDK for C#, Python and Java with "plugins" (tools) and planners; AutoGen focuses on conversations between multiple agents. Microsoft has since brought the two together in its Agent Framework.
- **CrewAI:** multi-agent framework built around **roles** (an agent with a role, goal and backstory), **tasks** and a **crew** that runs them in sequence or under a manager.
- **Vercel AI SDK** (TypeScript): a thin, provider-agnostic layer for web apps: `generateText`, `streamText`, `generateObject` for typed output, tool calling with Zod schemas, and React hooks such as `useChat` that handle the streaming protocol between server and browser.
- **Provider agent SDKs:** the **OpenAI Agents SDK** (March 2025) with agents, handoffs and guardrails, and the **Claude Agent SDK** from Anthropic, which exposes the agent loop and tools behind Claude Code. **Pydantic AI** brings typed, Pydantic-validated agents to Python.

## The Model Context Protocol (MCP)

The **Model Context Protocol**, released by Anthropic in **November 2024** and since adopted by OpenAI, Google, Microsoft and most agent frameworks, standardizes how an application connects a model to external **tools**, **resources** (data) and **prompts**. An **MCP server** wraps a system such as GitHub, a database or a file system once; any **MCP client** (an IDE, a chat app, an agent framework) can then use it. Before MCP, every framework and app needed its own integration for every tool. MCP is to tool integrations what the Language Server Protocol was to code editors.

## Frameworks versus hand-rolled code

**What frameworks give you:** fast prototypes, many integrations, a common vocabulary, streaming and retries handled, agents with persistence and human approval, and tracing.

**What they cost:** hidden prompts and requests, extra layers to debug, dependency churn, and abstractions that do not quite fit your case, which you end up working around.

A reasonable path, and the one this app follows: build each stage by hand first (raw `fetch` calls, plain SQL, your own prompt builder and stream parser) so you know exactly what happens, then adopt a framework where it saves real work and compare the two versions side by side. When something goes wrong in production, the ability to read the raw request and response is what lets you fix it.

## Summary

- **LangChain** provides standard interfaces for models, prompts, loaders, splitters, vector stores, retrievers and tools, composed with LCEL pipes; version 1.0 centres on `create_agent` with middleware.
- **LangGraph** models an application as a graph of nodes over shared state, with conditional edges for loops and branches and checkpointing for memory, human-in-the-loop and recovery.
- **LangSmith** traces and evaluates runs.
- **LlamaIndex**, **Haystack**, **DSPy**, **CrewAI**, the **Vercel AI SDK** and provider agent SDKs each emphasize a different part of the stack.
- **MCP** standardizes the connection between models and tools.
- Underneath all of them are the same chat, embedding and search calls you can write yourself.
