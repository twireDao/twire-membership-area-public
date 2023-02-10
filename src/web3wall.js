"use strict";

// Setup provider
const PROJECT_NAME = "SparkasseNFT"
const INFURA_ID = "293f80f0fc9644179a431897e14dfacc"
const TARGET_CHAIN_ID = 137 // polygon
// const TARGET_CHAIN_ID = 1 // eth mainnet
// const TARGET_CHAIN_ID = 5 // goerli
const TARGET_CHAIN_ID_HEX = "0x" + TARGET_CHAIN_ID.toString(16);

// Setup smart contract interaction
const TOKEN_LOCATION = "https://raw.githubusercontent.com/twireDao/twire-membership-area-public/main/src/twireMembershipNft.json"
const TOKEN_ADDRESS = "0x5c68479b17643f9ef02892d90f4c8c30d56af9aa"

// Unpkg imports
const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const Fortmatic = window.Fortmatic;
const evmChains = window.evmChains;

// Web3modal instance
let web3Modal

// Chosen wallet provider given by the dialog window
let provider;


// Address of the selected account
let selectedAccount;



/**
 * Setup the orchestra
 */
function init() {

    console.log("Initializing example");
    console.log("WalletConnectProvider is", WalletConnectProvider);
    console.log("window.ethereum is", window.ethereum);


    const providerOptions = {
        walletconnect: {
            package: WalletConnectProvider,
            options: {
                rpc: { 137: "https://matic-mainnet.chainstacklabs.com" },
                infuraId: INFURA_ID,
            }
        },
        'custom-coinbase': {
            display: {
                logo: 'https://avatars.githubusercontent.com/u/18060234?s=280&v=4',
                name: 'Coinbase Wallet',
                description: 'Connect to your Coinbase Wallet',
            },
            options: {
                rpc: { 137: "https://matic-mainnet.chainstacklabs.com" },
                infuraId: INFURA_ID,
            },
            package: WalletLink,
            connector: async (_, options) => {
                const { appName, networkUrl, chainId } = options
                const walletLink = new WalletLink({
                    appName
                });
                const provider = walletLink.makeWeb3Provider(networkUrl, chainId);
                await provider.enable();
                return provider;
            },
        }


    };

    web3Modal = new Web3Modal({
        cacheProvider: false, // optional
        providerOptions, // required
        disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
    });

    console.log("Web3Modal instance is", web3Modal);
}


/**
 * Kick in the UI action after Web3modal dialog has chosen a provider
 */
async function fetchAccountData() {

    // Get a Web3 instance for the wallet
    const web3 = new Web3(provider);

    console.log("Web3 instance is", web3);

    // Get connected chain id from Ethereum node
    const chainId = await web3.eth.getChainId();
    // Load chain information over an HTTP API
    const chainData = evmChains.getChain(chainId);
    // document.querySelector("#network-name").textContent = chainData.name;
    console.log("Got netowrk", chainData, chainData)

    // Get list of accounts of the connected wallet
    const accounts = await web3.eth.getAccounts();

    // MetaMask does not give you all accounts, only the selected account
    console.log("Got accounts", accounts);
    selectedAccount = accounts[0];

    // document.querySelector("#selected-account").textContent = selectedAccount;

    if (chainData.chainId != TARGET_CHAIN_ID) {
        document.querySelector("#changeChainInfo").style.display = "block";
        await requestNetworkChange()
        document.querySelector("#changeChainInfo").style.display = "none";
    }

    const isMember = await checkMembership();

    if (isMember) {
        document.querySelector("#nftOwner").style.display = "block";
    } else {
        document.querySelector("#noNftOwner").style.display = "block";
    }


    // Display fully loaded UI for wallet data
    document.querySelector("#prepare").style.display = "none";
    document.querySelector("#connected").style.display = "flex";



}



/**
 * Fetch account data for UI when
 * - User switches accounts in wallet
 * - User switches networks in wallet
 * - User connects wallet initially
 */
async function refreshAccountData() {

    // If any current data is displayed when
    // the user is switching acounts in the wallet
    // immediate hide this data
    document.querySelector("#connected").style.display = "none";
    document.querySelector("#prepare").style.display = "flex";

    // Disable button while UI is loading.
    // fetchAccountData() will take a while as it communicates
    // with Ethereum node via JSON-RPC and loads chain data
    // over an API call.
    document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
    await fetchAccountData(provider);
    document.querySelector("#btn-connect").removeAttribute("disabled")
}


/**
 * Connect wallet button pressed.
 */
async function onConnect() {

    console.log("Opening a dialog", web3Modal);
    try {
        provider = await web3Modal.connect();
    } catch (e) {
        console.log("Could not get a wallet connection", e);
        return;
    }

    // Subscribe to accounts change
    provider.on("accountsChanged", (accounts) => {
        fetchAccountData();
    });

    // Subscribe to chainId change
    provider.on("chainChanged", (chainId) => {
        fetchAccountData();
    });

    // Subscribe to networkId change
    provider.on("networkChanged", (networkId) => {
        fetchAccountData();
    });

    await refreshAccountData();
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {

    console.log("Killing the wallet connection", provider);

    // TODO: Which providers have close method?
    if (provider.close) {
        await provider.close();

        // If the cached provider is not cleared,
        // WalletConnect will default to the existing session
        // and does not allow to re-scan the QR code with a new wallet.
        // Depending on your use case you may want or want not his behavir.
        await web3Modal.clearCachedProvider();
        provider = null;
    }

    selectedAccount = null;

    // Set the UI back to the initial state
    document.querySelector("#prepare").style.display = "flex";
    document.querySelector("#connected").style.display = "none";
}

async function requestNetworkChange() {
    // Check if MetaMask is installed
    // MetaMask injects the global API into window.ethereum
    if (provider) {
        try {
            // check if polygon is installed
            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: TARGET_CHAIN_ID_HEX }], // chainId must be in hexadecimal numbers
            });
        } catch (error) {
            // This error code indicates that the chain has not been added to MetaMask
            // if it is not, then install it into the user MetaMask
            if (error.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: TARGET_CHAIN_ID_HEX,
                                rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
                            },
                        ],
                    });
                } catch (addError) {
                    console.error(addError);
                }
            }
            console.error(error);
        }
    } else {
        // if no window.ethereum then Provider is not installed
        alert('Provider is not installed. Please consider installing it: https://metamask.io/download.html');
    }
}

// Checks is a user is owner of a membership NFT 
async function checkMembership() {

    // Set up provider d
    const web3 = new Web3(provider);
    const ethersProvider = new ethers.providers.Web3Provider(window.ethereum)

    // Fetch api 
    const abiResponse = await fetch(TOKEN_LOCATION);
    const abi = await abiResponse.json();

    // Create instance of Token Smart Contrat 
    const TokenContract = new ethers.Contract(TOKEN_ADDRESS, abi, ethersProvider);

    // Get list of accounts of the connected wallet
    const accounts = await web3.eth.getAccounts();
    selectedAccount = accounts[0];

    const balance = await TokenContract.balanceOf(selectedAccount)

    console.log("Token balance:", balance)

    document.querySelector('#selected-account-address').value = selectedAccount;


    if (balance >= 1) {
        return true
    }

    return false
}

/**
 * Main entry point.
 */
window.addEventListener('load', async () => {
    init();
    document.querySelector("#btn-connect").addEventListener("click", onConnect);
    document.querySelector("#btn-disconnect").addEventListener("click", onDisconnect);
});
