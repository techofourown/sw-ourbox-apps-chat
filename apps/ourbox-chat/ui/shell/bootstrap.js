(function () {
  const contract = window.OurBoxChatContract;
  const createApp = window.createOurBoxChatApp;
  const view = window.OurBoxChatView;
  const root = document.getElementById("ourbox-chat-root");

  function renderBootError(message) {
    if (!root) {
      throw new Error(message);
    }

    root.textContent = message;
  }

  if (!contract || typeof createApp !== "function" || !root) {
    throw new Error("OurBox Chat shell boot failed");
  }

  const app = createApp();
  window.OurBoxChat = app;

  if (!view || typeof view.mount !== "function") {
    renderBootError("No compatible OurBox Chat view bundle was loaded.");
    app.destroy();
    delete window.OurBoxChat;
    return;
  }

  const shellMajor = String(contract.version).split(".")[0];
  const viewMajor = String(view.contractVersion || "").split(".")[0];
  if (!viewMajor || viewMajor !== shellMajor) {
    renderBootError("The loaded view bundle is not compatible with this app contract.");
    app.destroy();
    delete window.OurBoxChat;
    return;
  }

  let cleanupDone = false;
  let mountHandle = null;

  function cleanup() {
    if (cleanupDone) {
      return;
    }

    cleanupDone = true;

    if (mountHandle && typeof mountHandle.unmount === "function") {
      mountHandle.unmount();
    }

    app.destroy();

    if (window.OurBoxChat === app) {
      delete window.OurBoxChat;
    }
  }

  try {
    mountHandle = view.mount({
      root: root,
      app: app,
      contract: contract,
    });
  } catch (error) {
    cleanup();
    renderBootError("OurBox Chat could not mount the selected view.");
    throw error;
  }

  window.addEventListener("pagehide", cleanup, { once: true });
})();
