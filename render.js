document.getElementById('pingBtn').addEventListener('click', async () => {
  const res = await window.electronAPI.ping();
  document.getElementById('response').innerText = res;
});
