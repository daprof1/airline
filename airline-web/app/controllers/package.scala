import akka.actor.ActorSystem
import akka.stream.ActorMaterializer
import com.patson.data._
import com.patson.data.airplane._
import com.patson.model._
import com.patson.model.airplane._
import play.api.libs.json.{Format, JsArray, JsBoolean, JsNumber, JsObject, JsResult, JsString, JsSuccess, JsValue, Json, Reads, Writes}
import com.patson.model.Computation
import com.patson.Util
import com.patson.model.AirlineIncome
import com.patson.model.AirlineCashFlow
import com.patson.model.event.EventReward
import models.FacilityType
import models.AirportFacility
import com.patson.util.{AirlineCache, AirportCache, ChampionInfo}

import scala.concurrent.ExecutionContext



package object controllers {
  implicit val ec: ExecutionContext = ExecutionContext.global
  implicit val actorSystem = ActorSystem("patson-web-app-system")
  implicit val materializer = ActorMaterializer()
  implicit val order = Ordering.Double.IeeeOrdering

  implicit object AirlineFormat extends Format[Airline] {
    def reads(json: JsValue): JsResult[Airline] = {
      val airline = Airline.fromId((json \ "id").as[Int])
      JsSuccess(airline)
    }
    
    def writes(airline: Airline): JsValue = {
      var result = JsObject(List(
      "id" -> JsNumber(airline.id),
      "name" -> JsString(airline.name),
      "reputation" -> JsNumber(airline.getReputation()),
      "gradeValue" -> JsNumber(airline.airlineGrade.value),
      "airlineCode" -> JsString(airline.getAirlineCode()),
      "baseCount" -> JsNumber(airline.getBases().size),
      "isGenerated" -> JsBoolean(airline.isGenerated)))
      
      if (airline.getCountryCode.isDefined) {
        result = result.asInstanceOf[JsObject] + ("countryCode" -> JsString(airline.getCountryCode.get))
      }
      airline.getHeadQuarter().foreach { headquarters =>
        result = result.asInstanceOf[JsObject] + 
        ("headquartersAirportName" -> JsString(headquarters.airport.name)) + 
        ("headquartersCity" -> JsString(headquarters.airport.city)) + 
        ("headquartersAirportIata" -> JsString(headquarters.airport.iata))
      }
      
      result
    }
  }
  
  implicit object AirplaneModelWrites extends Writes[Model] {
    def writes(airplaneModel: Model): JsValue = {
          JsObject(List(
      "id" -> JsNumber(airplaneModel.id),
      "name" -> JsString(airplaneModel.name),
      "family" -> JsString(airplaneModel.family),
      "capacity" -> JsNumber(airplaneModel.capacity),
      "fuelBurn" -> JsNumber(airplaneModel.fuelBurn),
      "speed" -> JsNumber(airplaneModel.speed),
      "range" -> JsNumber(airplaneModel.range),
      "price" -> JsNumber(airplaneModel.price),
      "lifespan" -> JsNumber(airplaneModel.lifespan),
      "airplaneType" -> JsString(airplaneModel.airplaneTypeLabel),
      "minAirportSize" -> JsNumber(airplaneModel.minAirportSize),
      "badConditionThreshold" -> JsNumber(Airplane.BAD_CONDITION), //same for all models for now
      "criticalConditionThreshold" -> JsNumber(Airplane.CRITICAL_CONDITION), //same for all models for now
      "constructionTime" -> JsNumber(airplaneModel.constructionTime),
      "imageUrl" -> JsString(airplaneModel.imageUrl),
      "countryCode" -> JsString(airplaneModel.countryCode)
          ))
      
    }
  }

  object SimpleAirplaneWrite extends Writes[Airplane] {
    def writes(airplane: Airplane): JsValue = {
      JsObject(List(
        "id" -> JsNumber(airplane.id),
        "ownerId" -> JsNumber(airplane.owner.id),
        "name" -> JsString(airplane.model.name),
        "modelId" -> JsNumber(airplane.model.id),
        "capacity" -> JsNumber(airplane.model.capacity),
        "fuelBurn" -> JsNumber(airplane.model.fuelBurn),
        "speed" -> JsNumber(airplane.model.speed),
        "range" -> JsNumber(airplane.model.range),
        "price" -> JsNumber(airplane.model.price),
        "condition" -> JsNumber(airplane.condition),
        "constructedCycle" -> JsNumber(airplane.constructedCycle),
        "purchasedCycle" ->  JsNumber(airplane.purchasedCycle),
        "isReady" ->  JsBoolean(airplane.isReady),
        "constructionTime" -> JsNumber(airplane.model.constructionTime),
        "value" -> JsNumber(airplane.value),
        "sellValue" -> JsNumber(Computation.calculateAirplaneSellValue(airplane)),
        "dealerValue" -> JsNumber(airplane.dealerValue),
        "dealerRatio" -> JsNumber(airplane.dealerRatio),
        "configurationId" -> JsNumber(airplane.configuration.id),
        "configuration" -> Json.obj("economy" -> airplane.configuration.economyVal, "business" -> airplane.configuration.businessVal, "first" -> airplane.configuration.firstVal),
        //"availableFlightMinutes" -> JsNumber(airplane.availableFlightMinutes),
        "maxFlightMinutes" -> JsNumber(Airplane.MAX_FLIGHT_MINUTES),
        "homeAirportId" -> JsNumber(airplane.home.id),
        "badConditionThreshold" -> JsNumber(Airplane.BAD_CONDITION),
        "criticalConditionThreshold" -> JsNumber(Airplane.CRITICAL_CONDITION)
      ))
    }
  }
  
  implicit object AirplaneWrites extends Writes[Airplane] {
    def writes(airplane: Airplane): JsValue = {
      Json.toJson(airplane)(SimpleAirplaneWrite).asInstanceOf[JsObject] + ("availableFlightMinutes" -> JsNumber(airplane.availableFlightMinutes))
    }
  }
  
  implicit object LinkClassValuesWrites extends Writes[LinkClassValues] {
    def writes(linkClassValues: LinkClassValues): JsValue = JsObject(List(
      "economy" -> JsNumber(linkClassValues(ECONOMY)),
      "business" -> JsNumber(linkClassValues(BUSINESS)),
      "first" -> JsNumber(linkClassValues(FIRST))))
  }
  object AirplaneAssignmentsRead extends Reads[Map[Airplane, Int]] {
    def reads(json : JsValue) : JsResult[Map[Airplane, Int]] = {
      JsSuccess(json.asInstanceOf[JsObject].keys.map { airplaneId =>
        val frequency = json.\(airplaneId).as[Int]
        AirplaneSource.loadAirplaneById(airplaneId.toInt) match {
          case Some(airplane) => (airplane, frequency)
          case None => throw new IllegalStateException("Airplane with id " + airplaneId + " does not exist")
        }
      }.toMap)
    }
  }
  
  implicit object LinkFormat extends Format[Link] {
    def reads(json: JsValue): JsResult[Link] = {
      val fromAirportId = json.\("fromAirportId").as[Int]
      val toAirportId = json.\("toAirportId").as[Int]
      val airlineId = json.\("airlineId").as[Int]
      //val capacity = json.\("capacity").as[Int]
      val price = LinkClassValues.getInstance(json.\("price").\("economy").as[Int], json.\("price").\("business").as[Int], json.\("price").\("first").as[Int])
      val fromAirport = AirportCache.getAirport(fromAirportId, true).get
      val toAirport = AirportCache.getAirport(toAirportId, true).get
      val airline = AirlineCache.getAirline(airlineId).get
      val distance = Util.calculateDistance(fromAirport.latitude, fromAirport.longitude, toAirport.latitude, toAirport.longitude).toInt
      val flightType = Computation.getFlightType(fromAirport, toAirport, distance)
      val airplaneAssignments = json.\("airplanes").as[Map[Airplane, Int]](AirplaneAssignmentsRead)

      val modelId = json.\("model").as[Int]
      val modelOption = ModelSource.loadModelById(modelId)
      val duration = modelOption match {
        case Some(model) => Computation.calculateDuration(model, distance)
        case None => 0
      }
      val flightMinutesRequiredPerFlight = modelOption match {
        case Some(model) => Computation.calculateFlightMinutesRequired(model, distance)
        case None => 0
      }


      var rawQuality =  json.\("rawQuality").as[Int]
      if (rawQuality > Link.MAX_QUALITY) {
        rawQuality = Link.MAX_QUALITY
      } else if (rawQuality < 0) {
        rawQuality = 0
      }
         
      val link = Link(fromAirport, toAirport, airline, price, distance, capacity = LinkClassValues.getInstance(), rawQuality, duration, frequency = 0, flightType) //compute frequency and capacity after validating the assigned airplanes
      link.setAssignedAirplanes(airplaneAssignments.toList.map {
        case(airplane, frequency) => (airplane, LinkAssignment(frequency, frequency * flightMinutesRequiredPerFlight))
      }.toMap)
      //(json \ "id").asOpt[Int].foreach { link.id = _ } 
      JsSuccess(link)
    }
    
    def writes(link: Link): JsValue = {
      var json = JsObject(List(
      "id" -> JsNumber(link.id),
      "fromAirportId" -> JsNumber(link.from.id),
      "toAirportId" -> JsNumber(link.to.id),
      "fromAirportCode" -> JsString(link.from.iata),
      "toAirportCode" -> JsString(link.to.iata),
      "fromAirportName" -> JsString(link.from.name),
      "toAirportName" -> JsString(link.to.name),
      "fromAirportCity" -> JsString(link.from.city),
      "toAirportCity" -> JsString(link.to.city),
      "fromCountryCode" -> JsString(link.from.countryCode),
      "toCountryCode" -> JsString(link.to.countryCode),
      "airlineId" -> JsNumber(link.airline.id),
      "price" -> Json.toJson(link.price),
      "distance" -> JsNumber(link.distance),
      "capacity" -> Json.toJson(link.capacity),
      "rawQuality" -> JsNumber(link.rawQuality),
      "computedQuality" -> JsNumber(link.computedQuality),
      "duration" -> JsNumber(link.duration),
      "frequency" -> JsNumber(link.frequency),
      "availableSeat" -> Json.toJson(link.availableSeats),
      "fromLatitude" -> JsNumber(link.from.latitude),
      "fromLongitude" -> JsNumber(link.from.longitude),
      "toLatitude" -> JsNumber(link.to.latitude),
      "toLongitude" -> JsNumber(link.to.longitude),
      "flightType" -> JsString(link.flightType.toString()),
      "flightCode" -> JsString(LinkApplication.getFlightCode(link.airline, link.flightNumber))
      ))

      var airplanesJson = Json.arr()
      link.getAssignedAirplanes().foreach {
        case (airplane, assignment: LinkAssignment) => airplanesJson = airplanesJson.append(Json.obj("airplane" -> airplane, "frequency" -> assignment.frequency))
      }

      json = json + ("assignedAirplanes" -> airplanesJson)

      link.getAssignedModel().foreach { model =>
        json = json + ("modelId" -> JsNumber(model.id))
      }

      val constructingAirplanes = link.getAssignedAirplanes().filter(!_._1.isReady)
      if (!constructingAirplanes.isEmpty) {
        val waitTime = CycleSource.loadCycle() - constructingAirplanes.keys.map(_.constructedCycle).max
        json = json + ("future" -> Json.obj("frequency" -> link.futureFrequency(), "capacity" -> link.futureCapacity(), "waitTime" -> waitTime))
      }

      json
    }
  }
  
  object SimpleLinkConsumptionWrite extends Writes[LinkConsumptionDetails] {
     def writes(linkConsumption : LinkConsumptionDetails): JsValue = { 
       var priceJson = Json.obj() 
       LinkClass.values.foreach { linkClass =>
         if (linkConsumption.link.capacity(linkClass) > 0) { //do not report price for link class that has no capacity
           priceJson = priceJson + (linkClass.label -> JsNumber(linkConsumption.link.price(linkClass)))
         }  
       }
       
       
      JsObject(List(
        "linkId" -> JsNumber(linkConsumption.link.id),
        "airlineId" -> JsNumber(linkConsumption.link.airline.id),
        "airlineName" -> JsString(AirlineCache.getAirline(linkConsumption.link.airline.id).fold("<unknown airline>") { _.name }),
        "price" -> priceJson,
        "capacity" -> Json.toJson(linkConsumption.link.capacity),
        "frequency" -> JsNumber(linkConsumption.link.frequency),
        "soldSeats" -> JsNumber(linkConsumption.link.soldSeats.total),
        "quality" -> JsNumber(linkConsumption.link.computedQuality)))
    }
  }

  /**
    * Do not expose sold seats
    */
  object MinimumLinkConsumptionWrite extends Writes[LinkConsumptionDetails] {
    def writes(linkConsumption : LinkConsumptionDetails): JsValue = {
      var priceJson = Json.obj()
      LinkClass.values.foreach { linkClass =>
        if (linkConsumption.link.capacity(linkClass) > 0) { //do not report price for link class that has no capacity
          priceJson = priceJson + (linkClass.label -> JsNumber(linkConsumption.link.price(linkClass)))
        }
      }


      JsObject(List(
        "cycle" -> JsNumber(linkConsumption.cycle),
        "linkId" -> JsNumber(linkConsumption.link.id),
        "airlineId" -> JsNumber(linkConsumption.link.airline.id),
        "airlineName" -> JsString(AirlineCache.getAirline(linkConsumption.link.airline.id).fold("<unknown airline>") { _.name }),
        "price" -> priceJson,
        "capacity" -> Json.toJson(linkConsumption.link.capacity)))
    }
  }
  
  implicit object AirlineBaseFormat extends Format[AirlineBase] {
    def reads(json: JsValue): JsResult[AirlineBase] = {
      val airport = AirportCache.getAirport((json \ "airportId").as[Int]).get
      val airline = Airline.fromId((json \ "airlineId").as[Int])
      val scale = (json \ "scale").as[Int]
      val headquarter = (json \ "headquarter").as[Boolean]
      JsSuccess(AirlineBase(airline, airport, "", scale, 0, headquarter))
    }
    
    def writes(base: AirlineBase): JsValue = {
      var jsObject = JsObject(List(
      "airportId" -> JsNumber(base.airport.id),
      "airportName" -> JsString(base.airport.name),
      "airportCode" -> JsString(base.airport.iata),
      "countryCode" -> JsString(base.airport.countryCode),
      "airportZone" -> JsString(base.airport.zone),
      "city" -> JsString(base.airport.city),
      "airlineId" -> JsNumber(base.airline.id),
      "airlineName" -> JsString(base.airline.name),
      "scale" -> JsNumber(base.scale),
      "upkeep" -> JsNumber(base.getUpkeep),
      "value" -> JsNumber(base.getValue),
      "headquarter" -> JsBoolean(base.headquarter),
      "foundedCycle" -> JsNumber(base.foundedCycle)))
      
      base.airline.getCountryCode().foreach { countryCode =>
        jsObject = jsObject + ("airlineCountryCode" -> JsString(countryCode))
      }
      
      jsObject
    }
        
  }
  
  implicit object FacilityReads extends Reads[AirportFacility] {
    def reads(json: JsValue): JsResult[AirportFacility] = {
      val airport = AirportCache.getAirport((json \ "airportId").as[Int]).get
      val airline = Airline.fromId((json \ "airlineId").as[Int])
      val name = (json \ "name").as[String]
      val level = (json \ "level").as[Int]
      JsSuccess(AirportFacility(airline, airport, name, level, FacilityType.withName((json \ "type").as[String])))
    }
  }
  
  implicit object LoungeWrites extends Writes[Lounge] {
    def writes(lounge: Lounge): JsValue = {
      var jsObject = JsObject(List(
      "airportId" -> JsNumber(lounge.airport.id),
      "airportName" -> JsString(lounge.airport.name),
      "airlineId" -> JsNumber(lounge.airline.id),
      "airlineName" -> JsString(lounge.airline.name),
      "name" ->  JsString(lounge.name),
      "level" -> JsNumber(lounge.level),
      "upkeep" -> JsNumber(lounge.getUpkeep),
      "status" -> JsString(lounge.status.toString()),
      "type" -> JsString(FacilityType.LOUNGE.toString()),
      "foundedCycle" -> JsNumber(lounge.foundedCycle)))
      
      jsObject
    }
  }
  
  implicit object LoungeConsumptionDetailsWrites extends Writes[LoungeConsumptionDetails] {
    def writes(details: LoungeConsumptionDetails): JsValue = {
      var jsObject = JsObject(List(
      "lounge" -> Json.toJson(details.lounge),
      "selfVisitors" -> JsNumber(details.selfVisitors),
      "allianceVisitors" -> JsNumber(details.allianceVisitors),
      "cycle" -> JsNumber(details.cycle)))
      
      jsObject
    }
  }
  
  implicit object AirlineIncomeWrite extends Writes[AirlineIncome] {
     def writes(airlineIncome : AirlineIncome): JsValue = {
      JsObject(List(
        "airlineId" -> JsNumber(airlineIncome.airlineId),
        "totalProfit" -> JsNumber(airlineIncome.profit),
        "totalRevenue" -> JsNumber(airlineIncome.revenue),
        "totalExpense" -> JsNumber(airlineIncome.expense),
        "linksProfit" -> JsNumber(airlineIncome.links.profit),
        "linksRevenue" -> JsNumber(airlineIncome.links.revenue),
        "linksExpense" -> JsNumber(airlineIncome.links.expense),
        "linksTicketRevenue" -> JsNumber(airlineIncome.links.ticketRevenue),
        "linksAirportFee" -> JsNumber(airlineIncome.links.airportFee),
        "linksFuelCost" -> JsNumber(airlineIncome.links.fuelCost),
        "linksCrewCost" -> JsNumber(airlineIncome.links.crewCost),
        "linksInflightCost" -> JsNumber(airlineIncome.links.inflightCost),
        "linksDelayCompensation" -> JsNumber(airlineIncome.links.delayCompensation),
        "linksMaintenanceCost" -> JsNumber(airlineIncome.links.maintenanceCost),
        "linksLoungeCost" -> JsNumber(airlineIncome.links.loungeCost),
        "linksDepreciation" -> JsNumber(airlineIncome.links.depreciation),
        "transactionsProfit" -> JsNumber(airlineIncome.transactions.profit),
        "transactionsRevenue" -> JsNumber(airlineIncome.transactions.revenue),
        "transactionsExpense" -> JsNumber(airlineIncome.transactions.expense),
        "transactionsCapitalGain" -> JsNumber(airlineIncome.transactions.capitalGain),
        "transactionsCreateLink" -> JsNumber(airlineIncome.transactions.createLink),
        "othersProfit" -> JsNumber(airlineIncome.others.profit),
        "othersRevenue" -> JsNumber(airlineIncome.others.revenue),
        "othersExpense" -> JsNumber(airlineIncome.others.expense),
        "othersLoanInterest" -> JsNumber(airlineIncome.others.loanInterest),
        "othersBaseUpkeep" -> JsNumber(airlineIncome.others.baseUpkeep),
        "othersOvertimeCompensation" -> JsNumber(airlineIncome.others.overtimeCompensation),
        "othersLoungeUpkeep" -> JsNumber(airlineIncome.others.loungeUpkeep),
        "othersLoungeCost" -> JsNumber(airlineIncome.others.loungeCost),
        "othersLoungeIncome" -> JsNumber(airlineIncome.others.loungeIncome),
        "othersServiceInvestment" -> JsNumber(airlineIncome.others.serviceInvestment),
        "othersMaintenanceInvestment" -> JsNumber(airlineIncome.others.maintenanceInvestment),
        "othersAdvertisement" -> JsNumber(airlineIncome.others.advertisement),
        "othersFuelProfit" -> JsNumber(airlineIncome.others.fuelProfit),
        "othersDepreciation" -> JsNumber(airlineIncome.others.depreciation),
        "period" -> JsString(airlineIncome.period.toString()),
        "cycle" -> JsNumber(airlineIncome.cycle)))
    }
  }

  implicit object AirlineCashFlowWrite extends Writes[AirlineCashFlow] {
     def writes(airlineCashFlow : AirlineCashFlow): JsValue = {
      JsObject(List(
        "airlineId" -> JsNumber(airlineCashFlow.airlineId),
        "totalCashFlow" -> JsNumber(airlineCashFlow.cashFlow),
        "operation" -> JsNumber(airlineCashFlow.operation),
        "loanInterest" -> JsNumber(airlineCashFlow.loanInterest),
        "loanPrincipal" -> JsNumber(airlineCashFlow.loanPrincipal),
        "baseConstruction" -> JsNumber(airlineCashFlow.baseConstruction),
        "buyAirplane" -> JsNumber(airlineCashFlow.buyAirplane),
        "sellAirplane" -> JsNumber(airlineCashFlow.sellAirplane),
        "createLink" -> JsNumber(airlineCashFlow.createLink),
        "facilityConstruction" -> JsNumber(airlineCashFlow.facilityConstruction),
        "oilContract" -> JsNumber(airlineCashFlow.oilContract),
        "period" -> JsString(airlineCashFlow.period.toString()),
        "cycle" -> JsNumber(airlineCashFlow.cycle)))
    }
  }
  
  implicit object CountryWrites extends Writes[Country] {
    def writes(country : Country): JsValue = {
      Json.obj(
        "countryCode" -> country.countryCode,
        "name" -> country.name,
        "airportPopulation" -> country.airportPopulation,
        "incomeLevel" -> Computation.getIncomeLevel(country.income),
        "openness" ->  country.openness
      )
    }
  }
  
  implicit object CountryWithMutualRelationshipWrites extends Writes[(Country, Int)] {
    def writes(countryWithMutualRelationship : (Country, Int)): JsValue = {
      val (country, mutualRelationship) = countryWithMutualRelationship
      Json.obj(
        "countryCode" -> country.countryCode,
        "name" -> country.name,
        "airportPopulation" -> country.airportPopulation,
        "incomeLevel" -> Computation.getIncomeLevel(country.income),
        "openness" ->  country.openness,
        "mutualRelationship" -> mutualRelationship
      )
    }
  }
  
  implicit object ChampionedCountriesWrites extends Writes[ChampionInfo] {
    def writes(info : ChampionInfo): JsValue = {
      Json.obj(
              "country" -> Json.toJson(info.country),
              "airlineId" -> JsNumber(info.airline.id),
              "airlineName" -> JsString(info.airline.name),
              "ranking" -> JsNumber(info.ranking),
              "passengerCount" -> JsNumber(info.passengerCount),
              "reputationBoost" -> JsNumber(info.reputationBoost))
    }
  }

  implicit object CityWrites extends Writes[City] {
    def writes(city: City): JsValue = {
      val averageIncome = city.income
      val incomeLevel = (Math.log(averageIncome / 1000) / Math.log(1.1)).toInt
      JsObject(List(
        "id" -> JsNumber(city.id),
        "name" -> JsString(city.name),
        "latitude" -> JsNumber(city.latitude),
        "longitude" -> JsNumber(city.longitude),
        "countryCode" -> JsString(city.countryCode),
        "population" -> JsNumber(city.population),
        "incomeLevel" -> JsNumber(if (incomeLevel < 0) 0 else incomeLevel)))
    }
  }

  implicit object AirportFormat extends Format[Airport] {
    def reads(json: JsValue): JsResult[Airport] = {
      val airport = Airport.fromId((json \ "id").as[Int])
      JsSuccess(airport)
    }

    def writes(airport: Airport): JsValue = {
      val averageIncome = if (airport.population > 0) { airport.power / airport.population } else 0
      val incomeLevel = Computation.getIncomeLevel(airport.income)
      //      val appealMap = airport.airlineAppeals.foldRight(Map[Airline, Int]()) {
      //        case(Tuple2(airline, appeal), foldMap) => foldMap + Tuple2(airline, appeal.loyalty)
      //      }
      //      val awarenessMap = airport.airlineAppeals.foldRight(Map[Airline, Int]()) {
      //        case(Tuple2(airline, appeal), foldMap) => foldMap + Tuple2(airline, appeal.awareness)
      //      }

      var airportObject = JsObject(List(
        "id" -> JsNumber(airport.id),
        "name" -> JsString(airport.name),
        "iata" -> JsString(airport.iata),
        "icao" -> JsString(airport.icao),
        "city" -> JsString(airport.city),
        "size" -> JsNumber(airport.size),
        "latitude" -> JsNumber(airport.latitude),
        "longitude" -> JsNumber(airport.longitude),
        "countryCode" -> JsString(airport.countryCode),
        "population" -> JsNumber(airport.population),
        "slots" -> JsNumber(airport.slots),
        "radius" -> JsNumber(airport.airportRadius),
        "zone" -> JsString(airport.zone),
        "incomeLevel" -> JsNumber(if (incomeLevel < 0) 0 else incomeLevel)))


      if (airport.isSlotAssignmentsInitialized) {
        airportObject = airportObject + ("availableSlots" -> JsNumber(airport.availableSlots))
        airportObject = airportObject + ("slotAssignmentList" -> JsArray(airport.getAirlineSlotAssignments().toList.map {
          case (airlineId, slotAssignment) => Json.obj("airlineId" -> airlineId, "airlineName" -> AirlineCache.getAirline(airlineId).fold("<unknown>")(_.name), "slotAssignment" -> slotAssignment)
        }
        ))
      }
      if (airport.isAirlineAppealsInitialized) {
        airportObject = airportObject + ("appealList" -> JsArray(airport.getAirlineAdjustedAppeals().toList.map {
          case (airlineId, appeal) => Json.obj("airlineId" -> airlineId, "airlineName" -> AirlineCache.getAirline(airlineId).fold("<unknown>")(_.name), "loyalty" -> BigDecimal(appeal.loyalty).setScale(2, BigDecimal.RoundingMode.HALF_EVEN), "awareness" -> BigDecimal(appeal.awareness).setScale(2,  BigDecimal.RoundingMode.HALF_EVEN))
        }
        ))

        var bonusJson = Json.obj()
        airport.getAllAirlineBonuses.toList.foreach {
          case (airlineId, bonuses) => {
            var totalLoyaltyBonus = 0.0
            var totalAwarenessBonus = 0.0
            bonuses.foreach { entry =>
              totalLoyaltyBonus += entry.bonus.loyalty
              totalAwarenessBonus += entry.bonus.awareness
            }
            bonusJson = bonusJson + (airlineId.toString -> Json.obj("loyalty" -> totalLoyaltyBonus, "awareness" -> totalAwarenessBonus))
          }
        }
        airportObject = airportObject + ("bonusList" -> bonusJson)
      }
      if (airport.isFeaturesLoaded) {
        airportObject = airportObject + ("features" -> JsArray(airport.getFeatures().map { airportFeature =>
          Json.obj("type" -> airportFeature.featureType.toString(), "strength" -> airportFeature.strength, "title" -> AirportFeatureType.getDescription(airportFeature.featureType))
        }
        ))
      }
      if (airport.getAirportImageUrl.isDefined) {
        airportObject = airportObject + ("airportImageUrl" -> JsString(airport.getAirportImageUrl.get))
      }
      if (airport.getCityImageUrl.isDefined) {
        airportObject = airportObject + ("cityImageUrl" -> JsString(airport.getCityImageUrl.get))
      }

      airportObject = airportObject + ("citiesServed" -> Json.toJson(airport.citiesServed.map(_._1).toList))

      airportObject
    }
  }

  implicit object EventRewardWrite extends Writes[EventReward] {
    def writes(reward : EventReward): JsValue = JsObject(List(
      "description" -> JsString(reward.description),
      "optionId" -> JsNumber(reward.rewardOption.id),
      "categoryId" -> JsNumber(reward.rewardCategory.id)
    ))
  }

  val cachedAirportsByPower = AirportSource.loadAllAirports().sortBy(_.power)
}