# Pipeup add-on: Your own mailbox

A small server the author runs for Share, so even sealed comments stay inside their organisation. It is not a page script: nothing is added to the HTML for it, and the author gives you its address for `data-pipeup-share`.

- **Sends**: sealed comments, to a server the author runs. It holds ciphertext and never sees the key.
- **Needs**: Node 22 or newer, and an HTTPS proxy in front of it. Pipeup doesn't run a mailbox for anyone.
- **Run it**: `CREATE_TOKEN="$(openssl rand -base64 24)" DATA_DIR=./pipeup-mailbox npx @pipeup/mailbox`. Guide: https://github.com/pipeup-ai/pipeup/tree/main/services/mailbox#readme

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/mailbox.html) · [llms.txt](../llms.txt)
