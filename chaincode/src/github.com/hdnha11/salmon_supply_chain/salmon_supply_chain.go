package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

var logger = shim.NewLogger("SalmonSupplyChainV0")

type SalmonSupplyChain struct{}

type Salmon struct {
	ObjectType string `json:"docType"`
	Id         string `json:"id"`
	Vessel     string `json:"vessel"`
	Datetime   string `json:"datetime"`
	Location   string `json:"location"`
	Holder     string `json:"holder"`
}

func (*SalmonSupplyChain) Init(stub shim.ChaincodeStubInterface) peer.Response {
	return shim.Success(nil)
}

func (*SalmonSupplyChain) Invoke(stub shim.ChaincodeStubInterface) peer.Response {
	fn, args := stub.GetFunctionAndParameters()

	if fn == "recordSalmon" {
		return recordSalmon(stub, args)
	} else if fn == "changeSalmonHolder" {
		return changeSalmonHolder(stub, args)
	} else if fn == "querySalmon" {
		return querySalmon(stub, args)
	} else if fn == "queryAllSalmon" {
		return queryAllSalmon(stub)
	} else if fn == "initLedger" {
		return initLedger(stub)
	}

	return shim.Error(fmt.Sprintf("No such %s function", fn))
}

func recordSalmon(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	if len(args) != 5 {
		return shim.Error("Incorrect number of arguments. Expecting 5")
	}

	id := args[0]
	vessel := args[1]
	datetime := args[2]
	location := args[3]
	holder := args[4]

	if len(id) == 0 {
		return shim.Error("Id must be a non-empty string")
	}

	if len(vessel) == 0 {
		return shim.Error("Vessel must be a non-empty string")
	}

	if len(datetime) == 0 {
		return shim.Error("Datetime must be a non-empty string")
	}

	if len(location) == 0 {
		return shim.Error("Location must be a non-empty string")
	}

	if len(holder) == 0 {
		return shim.Error("Holder must be a non-empty string")
	}

	foundSalmon, err := stub.GetState(id)

	if err != nil {
		return shim.Error(fmt.Sprintf("Cannot get salmon %s. Error: %s", id, err.Error()))
	}

	if foundSalmon != nil {
		return shim.Error(fmt.Sprintf("Salmon %s already exists", id))
	}

	objectType := "salmon"
	salmon := Salmon{objectType, id, vessel, datetime, location, holder}
	salmonAsBytes, err := json.Marshal(salmon)

	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(id, salmonAsBytes)

	if err != nil {
		return shim.Error(err.Error())
	}

	logger.Infof("Salmon %s recorded", id)

	return shim.Success(nil)
}

func changeSalmonHolder(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	id := args[0]
	newHolder := args[1]

	if len(newHolder) == 0 {
		return shim.Error("Holder must be a non-empty string")
	}

	salmonAsBytes, err := stub.GetState(id)

	if err != nil {
		return shim.Error(fmt.Sprintf("Cannot get salmon %s. Error %s", id, err.Error()))
	}

	if salmonAsBytes == nil {
		return shim.Error(fmt.Sprintf("Salmon %s doesn't exist", id))
	}

	salmon := &Salmon{}

	err = json.Unmarshal(salmonAsBytes, salmon)

	if err != nil {
		return shim.Error(err.Error())
	}

	salmon.Holder = newHolder
	salmonAsBytes, err = json.Marshal(salmon)

	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(id, salmonAsBytes)

	if err != nil {
		return shim.Error(err.Error())
	}

	logger.Infof("Salmon %s has transfered to %s successfully", id, newHolder)
	return shim.Success(nil)
}

func querySalmon(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	salmonAsBytes, err := stub.GetState(args[0])

	if err != nil {
		return shim.Error(fmt.Sprintf("Cannot get salmon %s. Error: %s", args[0], err.Error()))
	}

	if salmonAsBytes == nil {
		return shim.Error(fmt.Sprintf("Salmon %s doesn't exist", args[0]))
	}

	return shim.Success(salmonAsBytes)
}

func queryAllSalmon(stub shim.ChaincodeStubInterface) peer.Response {
	resultsIterator, err := stub.GetStateByRange("", "")

	if err != nil {
		return shim.Error(err.Error())
	}

	var buffers bytes.Buffer
	buffers.WriteString("[")
	first := true
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()

		if err != nil {
			return shim.Error(err.Error())
		}

		if first != true {
			first = false
			buffers.WriteString(", ")
		}

		buffers.WriteString("{")
		buffers.WriteString("\"Key\": \"")
		buffers.WriteString(queryResponse.GetKey())
		buffers.WriteString("\", ")
		buffers.WriteString("\"Record\": ")
		buffers.WriteString(string(queryResponse.GetValue()))
		buffers.WriteString("}")
	}
	buffers.WriteString("]")

	return shim.Success(buffers.Bytes())
}

func initLedger(stub shim.ChaincodeStubInterface) peer.Response {
	sampleData := [][]string{
		[]string{"1", "Vessel #1", "2014-01-01", "Viet Nam", "Nha Hoang"},
		[]string{"2", "Vessel #2", "2016-04-22", "US", "Thanh Dong"},
		[]string{"3", "Vessel #3", "2017-11-13", "Korea", "Duy Nguyen"},
	}

	for _, args := range sampleData {
		res := recordSalmon(stub, args)
		if res.Status == shim.ERROR {
			return res
		}
	}

	return shim.Success(nil)
}

func main() {
	err := shim.Start(new(SalmonSupplyChain))

	if err != nil {
		logger.Errorf("Failed to start SimpleAsset chaincode: %s", err)
	}
}
