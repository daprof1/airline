package com.patson.model

import com.patson.model.airplane.Model
import com.patson.model.airplane.Model.Type
import FlightType._


abstract class AirportFeature {
  val MAX_STREGTH = 100
  def strength : Int
  //def airportId : Int
  def featureType : AirportFeatureType.Value
  val strengthFactor : Double = strength.toDouble / MAX_STREGTH
  
  def demandAdjustment(rawDemand : Double, passengerType : PassengerType.Value, airportId : Int, fromAirport : Airport, toAirport : Airport, flightType : FlightType.Value) : Double
}

object AirportFeature {
  import AirportFeatureType._
  def apply(featureType : AirportFeatureType, strength : Int) : AirportFeature = {
    featureType match {
      case INTERNATIONAL_HUB => InternationalHubFeature(strength)  
      case VACATION_HUB => VacationHubFeature(strength)
      case FINANCIAL_HUB => FinancialHubFeature(strength)
      case DOMESTIC_AIRPORT => DomesticAirportFeature(strength)
      case ISOLATED_TOWN => IsolatedTownFeature(strength)
      case OLYMPICS_PREPARATIONS => OlympicsPreparationsFeature(strength)
      case OLYMPICS_IN_PROGRESS => OlympicsInProgressFeature(strength)
    }
  }
}

sealed case class InternationalHubFeature(strength : Int) extends AirportFeature {
  val featureType = AirportFeatureType.INTERNATIONAL_HUB
  override def demandAdjustment(rawDemand : Double, passengerType : PassengerType.Value, airportId : Int, fromAirport : Airport, toAirport : Airport, flightType : FlightType) : Double = {
    if (airportId == toAirport.id) { //only affect if as a destination
      val multiplier =
        if (passengerType == PassengerType.BUSINESS) { //more obvious for business travelers
          2  
        } else {
          0.5
        }
      if (flightType == SHORT_HAUL_INTERNATIONAL || flightType == SHORT_HAUL_INTERCONTINENTAL) {
        (rawDemand * (strengthFactor * 0.5) * multiplier).toInt //at MAX_STREGTH, add 1x for business traveler, 0.2x for tourists (short haul)   
      } else if (flightType == LONG_HAUL_INTERNATIONAL || flightType == LONG_HAUL_INTERCONTINENTAL || flightType == ULTRA_LONG_HAUL_INTERCONTINENTAL) {
        (rawDemand * (strengthFactor * 1) * multiplier).toInt //at MAX_STREGTH, add 2x for business traveler, 0.4x for tourists (long haul)
      } else {
        0
      }
    } else {
      0
    }
  }
}

sealed case class VacationHubFeature(strength : Int) extends AirportFeature {
  val featureType = AirportFeatureType.VACATION_HUB
  override def demandAdjustment(rawDemand : Double, passengerType : PassengerType.Value, airportId : Int, fromAirport : Airport, toAirport : Airport, flightType : FlightType.Value) : Double = {
    if (toAirport.id == airportId && passengerType == PassengerType.TOURIST) { //only affect if as a destination and tourists
      val goFactor = { //out of how many people, will there be 1 going to this spot per year
        if (flightType == SHORT_HAUL_DOMESTIC) {
          50
        } else if (flightType == LONG_HAUL_DOMESTIC) {
          150  
        } else if (flightType == SHORT_HAUL_INTERNATIONAL) {
          100
        } else {
          250
        }
      }
      (fromAirport.population / goFactor / 52 * fromAirport.income / 50000  * strengthFactor).toInt //assume in a city of 50k income out of goFactor people, 1 will visit this spot at full strength (10)
    } else {
      0
    }
  }
}

sealed case class FinancialHubFeature(strength : Int) extends AirportFeature {
  val featureType = AirportFeatureType.FINANCIAL_HUB
  override def demandAdjustment(rawDemand : Double, passengerType : PassengerType.Value, airportId : Int, fromAirport : Airport, toAirport : Airport, flightType : FlightType.Value) : Double = {
    if (toAirport.id == airportId && passengerType == PassengerType.BUSINESS) { //only affect if as a destination and tourists
      val goFactor = 500 //out of how many people, will there be 1 going to this spot per year

      (fromAirport.population / goFactor / 52 * fromAirport.income / 50000  * strengthFactor).toInt //assume in a city of 50k income out of goFactor people, 1 will visit this spot
    } else {
      0
    }
  }
}

sealed case class DomesticAirportFeature(strength : Int) extends AirportFeature {
  val featureType = AirportFeatureType.DOMESTIC_AIRPORT
  override def demandAdjustment(rawDemand : Double, passengerType : PassengerType.Value, airportId : Int, fromAirport : Airport, toAirport : Airport, flightType : FlightType.Value) : Double = {
    if (flightType == SHORT_HAUL_DOMESTIC || flightType == LONG_HAUL_DOMESTIC) {
       (rawDemand * (strengthFactor)).toInt // * 2 demand 
    } else {
       (-1 * rawDemand * (strengthFactor)).toInt //remove all demand if it's a purely domestic one (stregth 10)
    }
  }
}

sealed case class IsolatedTownFeature(strength : Int) extends AirportFeature {
  val featureType = AirportFeatureType.ISOLATED_TOWN
  val HUB_MIN_POPULATION = 100000 // 
  override def demandAdjustment(rawDemand : Double, passengerType : PassengerType.Value, airportId : Int, fromAirport : Airport, toAirport : Airport, flightType : FlightType.Value) : Double = {
    if (flightType == SHORT_HAUL_DOMESTIC && toAirport.population >= HUB_MIN_POPULATION) {
      if (rawDemand < 0.01) { //up to 10 
        rawDemand * 1000 
      } else if (rawDemand <= 0.1) { //up to 20
        rawDemand * 200 
      } else if (rawDemand <= 0.5) { //up to 30
        rawDemand * 60
      } else if (rawDemand <= 2) { //up to 40
        rawDemand * 20
      } else if (rawDemand <= 5) { //up to 50
        rawDemand * 10
      } else if (rawDemand <= 10) { //up to 60
        rawDemand * 6
      } else {
        rawDemand * 2
      }
    } else {
      0
    }
  }
}

sealed case class OlympicsPreparationsFeature(strength : Int) extends AirportFeature {
  val featureType = AirportFeatureType.OLYMPICS_PREPARATIONS
  override def demandAdjustment(rawDemand : Double, passengerType : PassengerType.Value, airportId : Int, fromAirport : Airport, toAirport : Airport, flightType : FlightType.Value) : Double = {
    rawDemand
  }
}

sealed case class OlympicsInProgressFeature(strength : Int) extends AirportFeature {
  val featureType = AirportFeatureType.OLYMPICS_IN_PROGRESS
  override def demandAdjustment(rawDemand : Double, passengerType : PassengerType.Value, airportId : Int, fromAirport : Airport, toAirport : Airport, flightType : FlightType.Value) : Double = {
    rawDemand
  }
}


object AirportFeatureType extends Enumeration {
    type AirportFeatureType = Value
    val INTERNATIONAL_HUB, VACATION_HUB, FINANCIAL_HUB, DOMESTIC_AIRPORT, ISOLATED_TOWN, OLYMPICS_PREPARATIONS, OLYMPICS_IN_PROGRESS, UNKNOWN = Value
    def getDescription(featureType : AirportFeatureType) = {
      featureType match {
        case INTERNATIONAL_HUB => "International Hub - Attracts more international passengers especially business travelers"
        case VACATION_HUB => "Vacation Hub - Attracts more tourist passengers"
        case FINANCIAL_HUB => "Financial Hub - Attracts more business passengers"
        case DOMESTIC_AIRPORT => "Domestic Airport"
        case ISOLATED_TOWN => "Isolated Town - Increases demand flying to domestic airport with at least 100000 pop within 1000km"
        case OLYMPICS_PREPARATIONS => "Preparing the Olympic Games"
        case OLYMPICS_IN_PROGRESS => "Year of the Olympic Games"
        case UNKNOWN => "Unknown"
      }
    }
}