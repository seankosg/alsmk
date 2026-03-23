const CpmScheduler = () => {
  return (
    <div className="h-[calc(100vh-48px)] -m-3 sm:-m-4 md:-m-6">
      <iframe
        src="/cpm_network.html"
        className="w-full h-full border-0"
        title="CPM Network Scheduler"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
};

export default CpmScheduler;
