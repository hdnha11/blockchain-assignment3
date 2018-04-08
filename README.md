# Week 3 Project: Salmon Supply Chain

In this scenario we will model a provenance use case: tracking responsibly sourced fish from the fisherman to the restaurant.

This business network is composed of:
* Fredrick - Fisherman who catches sustainable and legal salmon and sells to restaurant owners.
* Regulator - Organization that verifies that the salmon was caught legally and sustainably.
* Alice - Restaurant owner who serves the salmon to hungry customers.
* Bob - Another restaurant owner who also buys salmon from Fredrick.

Using **Hyperledger Fabric** we will demonstrate how salmon fishing can be improved, starting from the source (fisherman Fredrick) to the table (chef Alice) so that customers can know where their salmon was caught!

### The Salmon Data

After each catch of salmon, Fredrick records the salmon information to the ledger. Only Fredrick (and other fishermen) can add or update the salmon information on the ledger. The regulator and restaurant owners can only read from the ledger.

**You will** create the Golang struct to hold the Salmon data that will be written to the ledger.

The fields should be:
* vessel (string)
* datetime (string)
* location (string)
* holder (string)

### Selling Salmon

Fredrick sells his salmon all across the world to chefs like Bob for $100 per kilo. However, he has a special deal with Alice to sell for $50 dolars per kilo. On a public blockchain, everyone would know that Alice is getting a better deal. Obiously this is not advantagous for Fredrick's business if the entire world knows how much each buyer is paying.

So Fredrick wants everyone to know the details of the salmon, but the sale price should be known only to the buyer and seller.

**You will** create the channels needed for this scenario.

### Regulating membership

The role of the Regulators is to confirm and verify the details of the salmon that the fishermen catch. In this case the regulator will approve fishermen by adding them to the network. For example, if Fredrick is found to be catching salmon illegally, he can have his membership revoked without compromising the entire network. This feature is critical in enterprise applications because business relationships change over time.

**You will** add the members to the business network.

### Chaincode and Channels!

This scenario has 2 seperate chaincodes:
1. Setting the price agreement between fishermen (Fredrick) and restauranteur (Alice/Bob).
2. Transferring the salmon from fishermen to restauranteur.

We'll use 3 channels to provide privacy and confidentiality of transactions:
1. Price agreement between Fredrick and Alice.
2. Price agreement between Fredrick and Bob.
3. Transfer of salmon.

**You will** write the chaincode to implement these transactions.

## Your Assignment!

### Create the network

Use the instructions to download the Fabric binaries and docker images and start a local network.

### Write and install the the chaincode on all peers

Write and install golang chaincode for these 3 transactions:
* ```recordSalmon``` -- adds salmon data to ledger, called by fisherman
  * this takes 5 arguments:
    * 0 - the id (key) of the salmon
    * 1 to 4 - (the 4 attributes of the salmon data)

* ```changeSalmonHolder``` -- change the owner of the salmon, called by restauranteur when they confirm receiving the salmon.
  * takes 2 arguments:
    * 0 - the id of the salmon
    * 1 - the name of the new holder

* ```querySalmon``` -- reads salmon data from ledger, called by restauranteur and regulator to view state of particular salmon
  * takes 1 argument - the id (key) of the salmon
  * returns JSON of the salmon data

* ```queryAllSalmon``` -- used by regulator to check sustainability of supply chain
  * takes no arguments, returns list of JSON of all salmon data

### Initialize the ledger

Add an additional chaincode method to add test data to the ledger:
* ```initLedger``` - spawns Salmon data into the ledger.

### Create a HTTP API for clients to interact with network

Use the NodeJS SDK to build a entrypoint for new clients to interact with the ledger and transactions.

## Walkthrough GIF

![week3-assignment-walkthrough](https://user-images.githubusercontent.com/1773032/38470854-14ff0e84-3b93-11e8-92bb-f7d7deb476d4.gif)

## Development

### Generate Artifacts

```
$ ./generate.sh
```

### Spin up the network

```
$ docker-compose -f docker-compose.yaml up -d
```

### Start the API server

```
$ npm install
$ npm start
```
