package com.patson

import com.patson.data._
import com.patson.model._

import scala.collection.mutable
import scala.collection.mutable.{Map, Set}

object AirportSimulation {
  val AWARENESS_DECAY = 0.1
  val AWARENESS_INCREMENT_WITH_LINKS = 0.5
  val AWARENESS_INCREMENT_WITH_HQ = 1.0
  val AWARENESS_INCREMENT_WITH_BASE = 0.5
  val AWARENESS_INCREMENT_MAX_WITH_HQ = 50 //how much awareness will increment to just because of being a HQ
  val AWARENESS_INCREMENT_MAX_WITH_BASE = 30 //how much awareness will increment to just because of being a HQ
  val LOYALTY_AUTO_INCREMENT_WITH_HQ = 0.05
  val LOYALTY_AUTO_INCREMENT_WITH_BASE = 0.02
  val LOYALTY_AUTO_INCREMENT_MAX_WITH_HQ = 30 //how much loyalty will increment to just because of being a HQ
  val LOYALTY_AUTO_INCREMENT_MAX_WITH_BASE = 15 //how much loyalty will increment to just because of being a HQ
  val LOYALTY_DECREMENT_BY_MINOR_DELAY = 0.5 //if all flights have minor delay
  val LOYALTY_DECREMENT_BY_MAJOR_DELAY = 2 //if all flights have major delay
  val LOYALTY_DECREMENT_BY_CANCELLATION = 4 //if all flights are cancelled
  
  private[patson] val LOYALTY_INCREMENT_BY_FLIGHTS = 1.0
  private[patson] val LOYALTY_DECREMENT_BY_FLIGHTS = 1.0
  
  
  
  
  def airportSimulation(cycle: Int, linkConsumptions : List[LinkConsumptionDetails]) = {
    println("starting airport simulation")
    println("loading all airports")
    //do decay
    var allAirports = AirportSource.loadAllAirports(true)
    println("finished loading all airports")
    
    println("Decay awareness")
    //decay awareness
    allAirports.foreach { airport =>
      val updatingAppeals = mutable.HashMap[Int, AirlineAppeal]()
      airport.getAirlineBaseAppeals().foreach {
        case(airlineId, AirlineAppeal(loyalty, awareness)) =>
          //decay    
          val newAwareness = if (awareness - AWARENESS_DECAY <= 0) 0 else awareness - AWARENESS_DECAY
          updatingAppeals.put(airlineId, AirlineAppeal(loyalty, newAwareness))
      }
       //add base on bases
      airport.getAirlineBases().values.foreach { base =>
        val airline = base.airline
        val appeal = updatingAppeals.getOrElse(airline.id, AirlineAppeal(0, 0))
        var awareness = appeal.awareness
        var loyalty = appeal.loyalty
        if (base.headquarter) {
          if (awareness < AWARENESS_INCREMENT_MAX_WITH_HQ) {
            awareness += AWARENESS_INCREMENT_WITH_HQ
          }
          if (loyalty < LOYALTY_AUTO_INCREMENT_MAX_WITH_HQ) {
            loyalty += LOYALTY_AUTO_INCREMENT_WITH_HQ
          }
        } else {
          if (awareness < AWARENESS_INCREMENT_MAX_WITH_BASE) {
            awareness += AWARENESS_INCREMENT_WITH_BASE
          }
          if (loyalty < LOYALTY_AUTO_INCREMENT_MAX_WITH_BASE) {
            loyalty += LOYALTY_AUTO_INCREMENT_WITH_BASE
          }
        }
        if (awareness > AirlineAppeal.MAX_AWARENESS) {
          awareness = AirlineAppeal.MAX_AWARENESS
        }
        if (loyalty > AirlineAppeal.MAX_LOYALTY) {
          loyalty = AirlineAppeal.MAX_LOYALTY
        }
        updatingAppeals.put(airline.id, AirlineAppeal(loyalty, awareness))
      }

      if (!updatingAppeals.isEmpty || !airport.getAirlineBaseAppeals().isEmpty) { //2nd or is for removal of existing appeals
        AirportSource.replaceAirlineAppeals(airport.id, updatingAppeals.toMap)
      }
    }

    println("Adjust awareness by links")
    //reload the airports after update
    allAirports = AirportSource.loadAllAirports(true)
    val allAirportsMap = allAirports.map( airport => airport.id -> airport).toMap

    //increment of awareness by links
    val links = LinkSource.loadAllLinks(LinkSource.ID_LOAD)
    
    val airportWithLinks = mutable.HashMap[Int, mutable.Set[Int]]() //(airportId, Set[airlineId])
    links.foreach { link =>
      val airlinesFliesFromThisAirport = airportWithLinks.getOrElseUpdate(link.from.id, mutable.HashSet[Int]())
      airlinesFliesFromThisAirport.add(link.airline.id)
      
      val airlinesFliesToThisAirport = airportWithLinks.getOrElseUpdate(link.to.id, mutable.HashSet[Int]())
      airlinesFliesToThisAirport.add(link.airline.id)
    }
    
    //add awareness based on airline with some links to/from an airport
    airportWithLinks.foreach {
      case(airportId, airlineIds) =>
        val updatingAppeals = mutable.HashMap[Int, AirlineAppeal]()
        airlineIds.foreach { airlineId =>
          val airport = allAirportsMap(airportId)
          val appeal = airport.getAirlineBaseAppeal(airlineId)
          val existingAwareness = appeal.awareness
          val newAwareness =
            if ((existingAwareness + AWARENESS_INCREMENT_WITH_LINKS) >= AirlineAppeal.MAX_AWARENESS) {
              AirlineAppeal.MAX_AWARENESS
            } else {
              existingAwareness + AWARENESS_INCREMENT_WITH_LINKS
            }
          //airport.setAirlineAwareness(airlineId, newAwareness)
          updatingAppeals.put(airlineId, AirlineAppeal(appeal.loyalty, newAwareness))
        }
        AirportSource.updateAirlineAppeals(airportId, updatingAppeals.toMap)
    }

    println("Adjust loyalty by link consumptions")
    //reload the airports after update
    allAirports = AirportSource.loadAllAirports(true)
    
    //update the loyalty on airports based on link consumption
    val toAirportSoldLinks = linkConsumptions.groupBy { _.link.to.id } //Map[(airportId, airlineId), links] //cannot use Airport instance directly as they are not the same instance
    val fromAirportSoldLinks = linkConsumptions.groupBy { _.link.from.id }
    val airportSoldLinks: scala.collection.immutable.Map[Int, Seq[LinkConsumptionDetails]] = 
      (toAirportSoldLinks.toSeq ++ fromAirportSoldLinks.toSeq).groupBy(_._1).mapValues { linkConsumptions =>
        linkConsumptions.map { 
          case (_, linkConsumptionsByDirection) => linkConsumptionsByDirection
        }.flatten
    }.toMap

    allAirports.foreach { airport =>
      val soldLinksOfThisAirport = airportSoldLinks.get(airport.id).getOrElse(Seq.empty[LinkConsumptionDetails])
      val soldLinksByAirline = scala.collection.mutable.Map(soldLinksOfThisAirport.groupBy { _.link.airline.id }.toSeq: _*)
      airport.getAirlineBaseAppeals().foreach {
        case(airlineId, _) =>  { //for all airlines that have record with this airport
          if (!soldLinksByAirline.contains(airlineId)) { //put an empty list, so it gets updated
            soldLinksByAirline.put(airlineId, Seq.empty[LinkConsumptionDetails])
          }
        }
      }
      //now the soldLinksByAirline should contain all the sold flights of this airport grouped by airline, if the airline no longer offer flights, it will be empty
      updateAirlineAppealsBySoldLinks(airport, soldLinksByAirline)
    }
    println("Finished simulation of loyalty by link consumption")


    println("Finished loyalty and awareness simulation")
    airportProjectSimulation(allAirports)

    AirportSource.purgeAirlineAppealBonus(cycle)
  }

  def airportProjectSimulation(allAirports : List[Airport]) = {
    import ProjectStatus._
    println("simulating airport projects")
    
    val inProgressProjects = AirportSource.loadAllAirportProjects().filter { _.status != COMPLETED }
  }
  
  private def updateAirlineAppealsBySoldLinks(airport : Airport, soldLinksByAirline : Map[Int, Seq[LinkConsumptionDetails]]) = {
    val newAppeals = mutable.HashMap[Int, AirlineAppeal]()
    soldLinksByAirline.foreach {
      case(airlineId, soldLinksByAirline) => {
        val targetLoyalty = getTargetLoyalty(soldLinksByAirline, airport.population)
        val appeal = airport.getAirlineBaseAppeal(airlineId)
        val currentLoyalty = appeal.loyalty //get the unadjusted value
        var newLoyalty = getNewLoyalty(currentLoyalty, targetLoyalty)
        val penalty = getPenalty(soldLinksByAirline)
//        if (penalty > 0) {
//          println("penalty for " + airlineId + " at airport " + airport + " is " + penalty)
//        }
        newLoyalty = newLoyalty - penalty
        if (newLoyalty <= 0) {
          newLoyalty = 0
        }
        
        //airport.setAirlineLoyalty(airlineId, newLoyalty)
        //AirportSource.updateAirlineAppeal(airport.id, airlineId, AirlineAppeal(newLoyalty, appeal.awareness))
        newAppeals.put(airlineId, AirlineAppeal(newLoyalty, appeal.awareness))
       // println("airport " + airport.name + " airline " + airlineId + " loyalty updating from " + currentLoyalty + " to " + newLoyalty)
      }
    }
    AirportSource.updateAirlineAppeals(airport.id, newAppeals.toMap)

    
    if (!airport.getLounges().isEmpty) {
      val airlinesByPassengers = soldLinksByAirline.mapValues( consumptionDetails => consumptionDetails.map {_.link.soldSeats.total}.sum).toList.sortBy(_._2) //Map[airlineId, totalPassengersForThisAirport]
      val eligibleAirlines = airlinesByPassengers.takeRight(airport.getLounges()(0).getActiveRankingThreshold).map(_._1)
      airport.getLounges().foreach { lounge =>
        val newStatus =
        if (eligibleAirlines.contains(lounge.airline.id)) {
          LoungeStatus.ACTIVE
        } else {
          LoungeStatus.INACTIVE
        }
        
        if (lounge.status != newStatus) {
          AirlineSource.saveLounge(lounge.copy(status = newStatus))
        }
      }
      
    }
    
    
    
  }
  
  private[patson] val getTargetLoyalty : (Seq[LinkConsumptionDetails], Long) => Double = (consumptionDetails, population) => {
    val totalTransportedPassengers = consumptionDetails.map { _.link.soldSeats.total }.sum 
    val totalQualityProduct = consumptionDetails.map { consumptionDetailsEntry => consumptionDetailsEntry.link.soldSeats.total * consumptionDetailsEntry.link.computedQuality }.sum
    val averageQuality = if (totalTransportedPassengers == 0) 0 else totalQualityProduct / totalTransportedPassengers
    val targetLoyaltyByQuality = averageQuality 
//    //to attain MAX loyalty requires transporting everyone (1 X pop) once per year, the increment in on power to MAX loyalty = weekly passenger
//    //ie base ^ 100 = pop / 52  
//    //   base = (pop / 52) ^ 0.01 
//    //and base ^ targetLoyaltyBypassengerVolume  = passenger
//    //    targetLoyaltyBypassengerVolume * log(base) = log(passenger)
//    //    targetLoyaltyBypassengerVolume = log(passenger) / (0.01 * log(pop/52))
//    //    targetLoyaltyBypassengerVolume = log(passenger) * 100 / log(pop/52) 
//    
//    // now pop needs to be bigger than 52, otherwise we have problem, in fact lets make min pop 10000
//
//     
//    val targetLoyaltyBypassengerVolume = Math.log(totalTransportedPassengers) * 100 / Math.log(Math.max(10000, population) / 52)
    
    
    //2nd formula:
    //  1. loyalty range [1, 100] are split into steps of 1
    //  2. From current step n, to reach next step n + 1 would require passengers of current step * a multiplier, denote the passenger of current step as p(n). we let p(1) = 1
    //  3. The multiplier itself is also a function to the step n, denote as m(n) 
    //  4. From 2. and 3., we can write formula of p(n + 1) = p(n) * m(n)
    //  5. Multiplier decrease proportionally to n, ie m(x) = m(1) - (m(1) - m(99)) * (x - 1) / 98
    //  6. Now we create conditions, we let:
    //    b. To reach last step of loyalty 100, m(99) = 1.0001
    //    a. at loyalty 1, m(1) > m(100), which we need to figure out in order to work on 5.
    //    c. Thinking from a city with 1M pop: 
    //        it should reach loyalty 100 if it transport every single pop within that year, therefore weekly passenger is 1000000 / 52, and we want p(100) = 1000000 / 52
    //        it should start with loyalty 1 if it transport 1 pop per week, therefore we want p(1) = 1
    //  7. Probably can be solved in some other fancy math, but i decided to let computer to estimate it for me ;) ...using binary search :\ (see method estimateM0), found m0 = 1.159339475631714
    //  8. Build an array LOYALTY_TO_PASSENGER_VOLUME, that lists required passenger to reach certain loyalty, the index is the Loyalty (based on 1mil pop)
    //  9. Now scale the required passengers with the city size relative to 1 million and search for matching loyalty 
    
    if (totalTransportedPassengers == 0) {
      0
    } else {
      var upper = AirlineAppeal.MAX_LOYALTY
      var lower = 1
      var found = false
      var estLoyalty = lower
      
      val normalizePassengers = totalTransportedPassengers.toDouble * 1000000 / population
      
      while (!found) {
        estLoyalty = (upper + lower) / 2
        if (LOYALTY_TO_PASSENGER_VOLUME(estLoyalty) > normalizePassengers) {
          upper = estLoyalty
        } else if (LOYALTY_TO_PASSENGER_VOLUME(estLoyalty) < normalizePassengers) {
          lower = estLoyalty
        } else {
          found = true
        }
        
        if (upper - lower == 1) {
          found = true
          estLoyalty += 1 //bump up one to the upper bound
        }
      }
      
      val targetLoyaltyBypassengerVolume = estLoyalty
      var targetLoyalty = Math.min(targetLoyaltyByQuality, targetLoyaltyBypassengerVolume).doubleValue()
      
      targetLoyalty
    }
  }
  
  private[patson] val getPenalty : Seq[LinkConsumptionDetails] => Double = consumptionDetails => {
      //add penalty for delays and cancellation
      val totalCapacity = consumptionDetails.map { _.link.capacity.total }.sum
      if (totalCapacity > 0) {
        val totalMinorDelayCapacity = consumptionDetails.filter(_.link.frequency > 0).map { linkConsumption => linkConsumption.link.capacity.total * linkConsumption.link.minorDelayCount / linkConsumption.link.frequency }.sum
        val totalMajorDelayCapacity = consumptionDetails.filter(_.link.frequency > 0).map { linkConsumption => linkConsumption.link.capacity.total * linkConsumption.link.majorDelayCount / linkConsumption.link.frequency}.sum
        val totalCancellationCapacity = consumptionDetails.filter(_.link.frequency > 0).map { linkConsumption => linkConsumption.link.capacity.total * linkConsumption.link.cancellationCount / linkConsumption.link.frequency}.sum
      
        val minorDelayPercentage = totalMinorDelayCapacity.toDouble / totalCapacity
        val majorDelayPercentage = totalMajorDelayCapacity.toDouble / totalCapacity
        val cancellationPercentage = totalCancellationCapacity.toDouble / totalCapacity
        
        minorDelayPercentage * LOYALTY_DECREMENT_BY_MINOR_DELAY + majorDelayPercentage * LOYALTY_DECREMENT_BY_MAJOR_DELAY + cancellationPercentage * LOYALTY_DECREMENT_BY_CANCELLATION
      } else {
        0
      }
  }
  
  private[patson] val LOYALTY_TO_PASSENGER_VOLUME : Array[Int] = { //array that lists required passenger to reach certain loyalty, the index is the Loyalty
    val m1 = estimateM1
    val m99 = 1.0001
    val result = Array.fill(AirlineAppeal.MAX_LOYALTY + 1)(0.0)
    
    result(1) = 1 //init
    for (x <- 1 until AirlineAppeal.MAX_LOYALTY) {
      val mx = m1 - (m1 - m99) * (x.toDouble - 1) / (AirlineAppeal.MAX_LOYALTY - 2) //m(x) = m(1) - (m(1) - m(99)) * (x - 1) / 98
      result(x + 1) = result(x) * mx 
    }
    
    result.map(_.toInt)
  }
  
  private[patson] val getNewLoyalty : (Double, Double) => Double = (currentLoyalty, targetLoyalty) =>  {
    if (currentLoyalty < targetLoyalty) { 
      if (currentLoyalty + LOYALTY_INCREMENT_BY_FLIGHTS >= targetLoyalty) {
        targetLoyalty
      } else {
        currentLoyalty + LOYALTY_INCREMENT_BY_FLIGHTS
      }
    } else {
      if (currentLoyalty - LOYALTY_DECREMENT_BY_FLIGHTS <= targetLoyalty) {
        targetLoyalty
      } else {
        currentLoyalty - LOYALTY_DECREMENT_BY_FLIGHTS
      }
    }
  }
  
  
  def estimateM1 : Double = {
    val m99 = 1.0001
    var m1Min = m99
    var m1Max = 2.0 //super crazy here
    val p = 1000000 / 52  //a city with 1 mil pop
    var pEst = 1.0 //estimate when n = 1
    var result = 0.0
    while (p.toInt != pEst.toInt) {
      pEst = 1.0 
      val m1Est = (m1Min + m1Max) / 2
      
      for (x <- 1 to AirlineAppeal.MAX_LOYALTY - 1) { //to reach the next loyalty step
        val mx = m1Est - (m1Est - m99) * (x.toDouble - 1) / (AirlineAppeal.MAX_LOYALTY - 2) //m(x) = m(1) - (m(1) - m(99)) * (x - 1) / 98
        pEst *= mx        
      }
      
      if (pEst > p) { //pEst to large
        m1Max = m1Est
      } else {
        m1Min = m1Est
      }
      
      result = m1Est
    }
    
    result
  }
  
 
}