import { task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-verify";
import "hardhat-contract-sizer";
import "hardhat-abi-exporter";
import "hardhat-gas-reporter";
import * as dotenv from "dotenv";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_taskArgs: {}, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const {
  TESTNET_PRIVATE_KEY: testnetPrivateKey,
  MAINNET_PRIVATE_KEY: mainnetPrivateKey,
  ETHERSCAN_API_KEY: etherscanApiKey,
} = process.env;
const reportGas = process.env.REPORT_GAS;

// Use dummy private key for local testing if not provided
const DEFAULT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    "sepolia": {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts: testnetPrivateKey ? [testnetPrivateKey] : [DEFAULT_PRIVATE_KEY],
      timeout: 40000,
    },
    "ethereum": {
      url: "https://ethereum-rpc.publicnode.com",
      chainId: 1,
      accounts: mainnetPrivateKey ? [mainnetPrivateKey] : [DEFAULT_PRIVATE_KEY],
      timeout: 60000,
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          viaIR: true
        },
      }
    ],
  },
  abiExporter: {
    path: "data/abi",
    runOnCompile: true,
    clear: true,
    flat: false,
    only: [],
    spacing: 4,
  },
  gasReporter: {
    enabled: reportGas == "1",
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
  },
  etherscan: {
    apiKey: etherscanApiKey || "",
  },
  sourcify: {
    // Disabled by default
    // Doesn't need an API key
    enabled: false,
  },
  mocha: {
    timeout: 40000,
  },
  namedAccounts: {
    deployer: 0,
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
};